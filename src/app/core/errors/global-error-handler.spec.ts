import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { GlobalErrorHandler } from './global-error-handler';
import { LoggerService } from '../services/logger.service';
import { NotificationService } from '../services/notification.service';

describe('GlobalErrorHandler', () => {
  let handler: ErrorHandler;
  let logger: { error: ReturnType<typeof vi.fn> };
  let notifications: { error: ReturnType<typeof vi.fn> };
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = { error: vi.fn() };
    notifications = { error: vi.fn() };
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useClass: GlobalErrorHandler },
        { provide: LoggerService, useValue: logger },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    handler = TestBed.inject(ErrorHandler);
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['string', 'string failure', 'string failure'],
    ['object', { status: 503, source: 'config' }, '{"status":503,"source":"config"}'],
    ['null', null, 'Unknown global error: null'],
    ['undefined', undefined, 'Unknown global error: undefined'],
  ])('normalizes a %s error for diagnostics', (_type, input, expectedMessage) => {
    handler.handleError(input);

    const diagnostic = logger.error.mock.calls[0][1];
    expect(diagnostic).toBeInstanceOf(Error);
    expect((diagnostic as Error).message).toBe(expectedMessage);
  });

  it('preserves Error diagnostics and keeps exception details out of the notification', () => {
    const error = new Error('database credentials leaked');

    handler.handleError(error);

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith('[GlobalErrorHandler] Unhandled error:', error);
    expect(notifications.error).toHaveBeenCalledOnce();
    expect(notifications.error).toHaveBeenCalledWith('An unexpected error occurred.');
    expect(notifications.error.mock.calls[0][0]).not.toContain(error.message);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('unwraps Angular original errors for diagnostics', () => {
    const original = new Error('original failure');

    handler.handleError({ ngOriginalError: original });

    expect(logger.error).toHaveBeenCalledWith('[GlobalErrorHandler] Unhandled error:', original);
    expect(notifications.error).toHaveBeenCalledOnce();
  });

  it('still notifies without escaping when logging fails', () => {
    logger.error.mockImplementation(() => {
      throw new Error('logger failed');
    });

    expect(() => handler.handleError(new Error('application failed'))).not.toThrow();

    expect(logger.error).toHaveBeenCalledOnce();
    expect(notifications.error).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('uses the fallback without escaping when notification fails', () => {
    notifications.error.mockImplementation(() => {
      throw new Error('notification failed');
    });

    expect(() => handler.handleError(new Error('application failed'))).not.toThrow();

    expect(logger.error).toHaveBeenCalledOnce();
    expect(notifications.error).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('does not escape or recurse when both dependencies fail', () => {
    logger.error.mockImplementation(() => {
      throw new Error('logger failed');
    });
    notifications.error.mockImplementation(() => {
      throw new Error('notification failed');
    });

    expect(() => handler.handleError(new Error('application failed'))).not.toThrow();

    expect(logger.error).toHaveBeenCalledOnce();
    expect(notifications.error).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledTimes(2);
  });
});
