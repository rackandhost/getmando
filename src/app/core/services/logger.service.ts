import {Injectable, isDevMode} from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoggerService {
  debug(message?: unknown, ...optionalParams: unknown[]): void {
    if (!isDevMode()) return;

    console.debug(message, ...optionalParams);
  }

  info(message?: unknown, ...optionalParams: unknown[]): void {
    if (!isDevMode()) return;

    console.info(message, ...optionalParams);
  }

  warn(message?: unknown, ...optionalParams: unknown[]): void {
    console.warn(message, ...optionalParams);
  }

  error(message?: unknown, ...optionalParams: unknown[]): void {
    console.error(message, ...optionalParams);
  }
}
