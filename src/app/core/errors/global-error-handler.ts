import { ErrorHandler, inject, Injectable } from '@angular/core';

import { LoggerService } from '../services/logger.service';
import { NotificationService } from '../services/notification.service';

const SAFE_ERROR_MESSAGE = 'An unexpected error occurred.';
const UNKNOWN_ERROR_MESSAGE = 'Unknown global error';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly logger = inject(LoggerService);
  private readonly notifications = inject(NotificationService);

  handleError(error: unknown): void {
    const diagnostic = this.normalizeError(error);

    try {
      this.logger.error('[GlobalErrorHandler] Unhandled error:', diagnostic);
    } catch (loggerError) {
      this.fallback('[GlobalErrorHandler] Logger failed while handling an error:', {
        diagnostic,
        loggerError,
      });
    }

    try {
      this.notifications.error(SAFE_ERROR_MESSAGE);
    } catch (notificationError) {
      this.fallback('[GlobalErrorHandler] Notification failed while handling an error:', {
        diagnostic,
        notificationError,
      });
    }
  }

  private normalizeError(error: unknown): Error {
    const originalError = this.unwrapAngularError(error);

    if (originalError instanceof Error) return originalError;
    if (typeof originalError === 'string') return new Error(originalError);
    if (originalError === null) return new Error(`${UNKNOWN_ERROR_MESSAGE}: null`);
    if (originalError === undefined) return new Error(`${UNKNOWN_ERROR_MESSAGE}: undefined`);

    try {
      const seen = new WeakSet<object>();
      const serialized = JSON.stringify(originalError, (_key, value: unknown) => {
        if (typeof value !== 'object' || value === null) return value;
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
        return value;
      });
      return new Error(serialized ?? this.safeString(originalError));
    } catch {
      return new Error(this.safeString(originalError));
    }
  }

  private unwrapAngularError(error: unknown): unknown {
    let current = error;
    const seen = new Set<unknown>();

    while (typeof current === 'object' && current !== null && !seen.has(current)) {
      seen.add(current);
      try {
        const original = Reflect.get(current, 'ngOriginalError') as unknown;
        if (original === undefined) break;
        current = original;
      } catch {
        break;
      }
    }

    return current;
  }

  private safeString(value: unknown): string {
    try {
      return String(value);
    } catch {
      return UNKNOWN_ERROR_MESSAGE;
    }
  }

  private fallback(message: string, context: unknown): void {
    try {
      console.error(message, context);
    } catch {
      // The global handler must never propagate failures from its last-resort fallback.
    }
  }
}
