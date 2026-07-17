import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { appConfig } from './app.config';
import { GlobalErrorHandler } from './core/errors/global-error-handler';

describe('appConfig', () => {
  it('resolves the custom handler and registers browser error forwarding', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    TestBed.configureTestingModule({ providers: appConfig.providers });
    const handler = TestBed.inject(ErrorHandler);

    expect(handler).toBeInstanceOf(GlobalErrorHandler);
    expect(addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });
});
