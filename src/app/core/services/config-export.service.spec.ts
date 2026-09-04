import { TestBed } from '@angular/core/testing';

import { ConfigExportService } from './config-export.service';
import { LoggerService } from './logger.service';
import { NotificationService } from './notification.service';

describe('ConfigExportService', () => {
  let service: ConfigExportService;
  let logger: { error: ReturnType<typeof vi.fn> };
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  let originalClipboardDescriptor: PropertyDescriptor | undefined;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  beforeEach(() => {
    logger = { error: vi.fn() };
    notifications = { success: vi.fn(), error: vi.fn() };
    originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    TestBed.configureTestingModule({
      providers: [
        ConfigExportService,
        { provide: LoggerService, useValue: logger },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    service = TestBed.inject(ConfigExportService);
  });

  function stubClipboard(clipboard: { writeText: (text: string) => Promise<void> }): void {
    // navigator.clipboard can be a getter-only accessor in jsdom, so Object.assign
    // throws; redefine the property instead.
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
  }

  it('copies canonical YAML to the clipboard and confirms success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    await expect(service.copy('metadata: {}\n')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('metadata: {}\n');
    expect(notifications.success).toHaveBeenCalledWith('YAML copied to the clipboard.');
  });

  it('reports a clipboard failure once without throwing', async () => {
    const failure = new Error('Denied');
    stubClipboard({ writeText: vi.fn().mockRejectedValue(failure) });

    await expect(service.copy('metadata: {}\n')).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith('[ConfigExport] Failed to copy YAML:', failure);
    expect(notifications.error).toHaveBeenCalledWith(
      'Unable to copy YAML. Check clipboard permissions.',
    );
  });

  it('downloads canonical YAML as dashboard.yaml without a server request', () => {
    const createObjectURL = vi.fn(() => 'blob:dashboard');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    expect(service.download('metadata: {}\n')).toBe(true);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:dashboard');
    expect(notifications.success).toHaveBeenCalledWith('YAML downloaded as dashboard.yaml.');
  });
});
