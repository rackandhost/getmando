import { signal } from '@angular/core';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DashboardConfig, DEFAULT_DASHBOARD_CONFIG } from '../../core/models/dashboard.models';
import { ConfigExportService } from '../../core/services/config-export.service';
import { LoggerService } from '../../core/services/logger.service';
import { NotificationService } from '../../core/services/notification.service';
import { YamlCodecService } from '../../core/services/yaml-codec.service';
import { expectNoAxeViolations } from '../../../testing/a11y';

import { ConfiguratorPageComponent } from './configurator-page.component';
import { ConfiguratorStore } from './configurator.store';

describe('ConfiguratorPageComponent', () => {
  const originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const originalUrlDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'URL');
  const draft = signal<DashboardConfig>({
    ...DEFAULT_DASHBOARD_CONFIG,
    metadata: { ...DEFAULT_DASHBOARD_CONFIG.metadata },
    categories: [{ id: 'media', name: 'Media' }],
    applications: [
      {
        id: 'plex',
        name: 'Plex',
        description: 'Media server',
        url: 'https://plex.example.test',
        icon: { type: 'name' as const, value: 'plex' },
        category: 'media',
        openNewTab: true,
        tags: [],
        favorite: false,
      },
    ],
    bookmarks: [],
  });
  const validationErrors = signal([
    { path: ['applications', '0', 'category'], message: "Category 'missing' does not exist." },
  ]);
  const yamlCodec = { serialize: vi.fn(() => 'metadata:\n  title: Mando\n') };
  const logger = { error: vi.fn() };
  const notifications = { success: vi.fn(), error: vi.fn() };

  const store = {
    draft,
    validationErrors,
    updateMetadata: vi.fn(),
    updateSettings: vi.fn(),
    addCategory: vi.fn(),
    addApplication: vi.fn(),
    addBookmark: vi.fn(),
    updateCategory: vi.fn(),
    updateApplication: vi.fn(),
    updateBookmark: vi.fn(),
    removeCategory: vi.fn(),
    removeApplication: vi.fn(),
    removeBookmark: vi.fn(),
    moveCategory: vi.fn(),
    moveApplication: vi.fn(),
    moveBookmark: vi.fn(),
    validate: vi.fn(() => false),
    toDashboardConfig: vi.fn(() => undefined),
    canLoadMountedConfig: vi.fn(() => false),
    startEmpty: vi.fn(),
    loadMountedConfig: vi.fn(),
    importLocalYaml: vi.fn(),
  };

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
    vi.restoreAllMocks();

    if (originalFetchDescriptor) {
      Object.defineProperty(globalThis, 'fetch', originalFetchDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'fetch');
    }

    if (originalUrlDescriptor) {
      Object.defineProperty(globalThis, 'URL', originalUrlDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'URL');
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    validationErrors.set([
      { path: ['applications', '0', 'category'], message: "Category 'missing' does not exist." },
    ]);
    store.validate.mockReturnValue(false);
    store.toDashboardConfig.mockReturnValue(undefined);
    store.canLoadMountedConfig.mockReturnValue(false);
  });

  function exportProviders() {
    return [
      { provide: YamlCodecService, useValue: yamlCodec },
      { provide: LoggerService, useValue: logger },
      { provide: NotificationService, useValue: notifications },
      ConfigExportService,
    ];
  }

  it('starts empty, loads mounted YAML, and imports a local YAML file from explicit entry controls', async () => {
    const user = userEvent.setup();
    store.canLoadMountedConfig.mockReturnValue(true);
    await render(ConfiguratorPageComponent, {
      providers: [{ provide: ConfiguratorStore, useValue: store }],
    });

    await user.click(screen.getByRole('button', { name: 'Start empty' }));
    await user.click(screen.getByRole('button', { name: 'Load mounted YAML' }));
    await user.upload(
      screen.getByLabelText('Import local YAML'),
      new File(['metadata:\n  title: Imported\n'], 'dashboard.yaml', { type: 'text/yaml' }),
    );

    expect(store.startEmpty).toHaveBeenCalledOnce();
    expect(store.loadMountedConfig).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(store.importLocalYaml).toHaveBeenCalledWith('metadata:\n  title: Imported\n'),
    );
  });

  it('edits schema-backed metadata and settings fields from accessible controls', async () => {
    const user = userEvent.setup();
    await render(ConfiguratorPageComponent, {
      providers: [{ provide: ConfiguratorStore, useValue: store }],
    });

    await user.clear(screen.getByLabelText('Dashboard description'));
    await user.type(screen.getByLabelText('Dashboard description'), 'Updated description');
    await user.clear(screen.getByLabelText('Items per row'));
    await user.type(screen.getByLabelText('Items per row'), '6');
    await user.click(screen.getByLabelText('Show date'));
    await user.click(screen.getByLabelText('youtube'));

    expect(store.updateMetadata).toHaveBeenLastCalledWith({ description: 'Updated description' });
    expect(store.updateSettings).toHaveBeenCalledWith({ itemsPerRow: 6 });
    expect(store.updateSettings).toHaveBeenCalledWith({ showDate: true });
    expect(store.updateSettings).toHaveBeenCalledWith({ searchEngines: ['youtube'] });
  });

  it('blocks copy and download when the draft is invalid', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    await render(ConfiguratorPageComponent, {
      providers: [{ provide: ConfiguratorStore, useValue: store }, ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Copy YAML' }));
    await user.click(screen.getByRole('button', { name: 'Download YAML' }));

    expect(store.validate).toHaveBeenCalledTimes(2);
    expect(yamlCodec.serialize).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
    expect(notifications.success).not.toHaveBeenCalled();
  });

  it('copies canonical YAML and confirms the successful browser-only export', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn();
    store.validate.mockReturnValue(true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetch });
    await render(ConfiguratorPageComponent, {
      providers: [{ provide: ConfiguratorStore, useValue: store }, ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Copy YAML' }));

    expect(yamlCodec.serialize).toHaveBeenCalledWith(draft());
    expect(writeText).toHaveBeenCalledWith('metadata:\n  title: Mando\n');
    expect(notifications.success).toHaveBeenCalledWith('YAML copied to the clipboard.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('downloads canonical YAML as dashboard.yaml and confirms no server write', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:dashboard');
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const fetch = vi.fn();
    store.validate.mockReturnValue(true);
    Object.defineProperty(globalThis, 'URL', {
      configurable: true,
      value: { createObjectURL, revokeObjectURL },
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetch });
    await render(ConfiguratorPageComponent, {
      providers: [{ provide: ConfiguratorStore, useValue: store }, ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Download YAML' }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(notifications.success).toHaveBeenCalledWith('YAML downloaded as dashboard.yaml.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('associates application icon validation feedback with the selected icon value field', async () => {
    validationErrors.set([
      { path: ['applications', '0', 'icon', 'value'], message: 'Icon value cannot be empty.' },
    ]);
    await render(ConfiguratorPageComponent, {
      providers: [{ provide: ConfiguratorStore, useValue: store }],
    });

    expect(screen.getByLabelText('Icon name for Plex')).toHaveAttribute(
      'aria-describedby',
      'application-icon-name-help-0 error-applications-0-icon-value',
    );
    expect(screen.getByText('Icon value cannot be empty.', { selector: 'p' })).toHaveAttribute(
      'id',
      'error-applications-0-icon-value',
    );
    expect(screen.getByRole('link', { name: 'Icon value cannot be empty.' })).toHaveAttribute(
      'href',
      '#field-applications-0-icon-value',
    );
  });

  it('renders labeled settings fields and associates an actionable error summary with invalid fields', async () => {
    await render(ConfiguratorPageComponent, {
      providers: [{ provide: ConfiguratorStore, useValue: store }],
    });

    expect(screen.getByRole('heading', { name: 'Configuration editor' })).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard title')).toHaveValue('Mando');
    expect(screen.getByLabelText('Theme')).toHaveValue('dark');
    expect(screen.getByRole('alert')).toHaveTextContent("Category 'missing' does not exist.");
    expect(screen.getByLabelText('Application category for Plex')).toHaveAttribute(
      'aria-describedby',
      'error-applications-0-category',
    );
    expect(
      screen.getByRole('link', { name: "Category 'missing' does not exist." }),
    ).toHaveAttribute('href', '#field-applications-0-category');
  });

  it('keeps the editor keyboard-accessible and free of detectable AXE violations', async () => {
    const user = userEvent.setup();
    const view = await render(ConfiguratorPageComponent, {
      providers: [{ provide: ConfiguratorStore, useValue: store }],
    });

    await user.tab();
    expect(screen.getByRole('button', { name: 'Start empty' })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Import local YAML')).toHaveFocus();

    await expectNoAxeViolations(view.container);
  });

  it('writes bookmark URL edits through the typed draft store', async () => {
    const user = userEvent.setup();
    draft.set({
      ...draft(),
      bookmarks: [
        {
          id: 'docs',
          name: 'Docs',
          description: '',
          url: 'https://docs.example.test',
          icon: { type: 'initials', value: 'DO' },
          openNewTab: true,
          tags: [],
        },
      ],
    });
    await render(ConfiguratorPageComponent, {
      providers: [{ provide: ConfiguratorStore, useValue: store }],
    });

    const url = screen.getByLabelText('Bookmark URL for Docs');
    await user.clear(url);
    await user.type(url, 'https://handbook.example.test');

    expect(store.updateBookmark).toHaveBeenLastCalledWith(0, {
      url: 'https://handbook.example.test',
    });
  });
});
