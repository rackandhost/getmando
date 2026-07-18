import { TestBed } from '@angular/core/testing';
import { ApplicationInitStatus, provideAppInitializer } from '@angular/core';
import { firstValueFrom, of, throwError } from 'rxjs';

import { initializeDashboard } from './dashboard.initializer';
import { YamlLoaderService } from '../services/yaml-loader.service';
import { AppService } from '../services/app.service';
import { LoggerService } from '../services/logger.service';
import { NotificationService } from '../services/notification.service';
import { DEFAULT_DASHBOARD_CONFIG } from '../models/dashboard.models';

describe('initializeDashboard', () => {
  let logger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let yamlLoader: {
    loadDashboardConfig: ReturnType<typeof vi.fn>;
  };
  let appService: {
    initializeConfig: ReturnType<typeof vi.fn>;
  };
  let notifications: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };
    yamlLoader = {
      loadDashboardConfig: vi.fn(),
    };
    appService = {
      initializeConfig: vi.fn(),
    };
    notifications = { error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: LoggerService, useValue: logger },
        { provide: YamlLoaderService, useValue: yamlLoader },
        { provide: AppService, useValue: appService },
        { provide: NotificationService, useValue: notifications },
      ],
    });
  });

  it('registers a supported initializer and initializes config exactly once', async () => {
    yamlLoader.loadDashboardConfig.mockReturnValue(of(DEFAULT_DASHBOARD_CONFIG));
    TestBed.configureTestingModule({ providers: [provideAppInitializer(initializeDashboard)] });

    const status = TestBed.inject(ApplicationInitStatus) as ApplicationInitStatus & {
      runInitializers(): void;
    };
    status.runInitializers();
    await status.donePromise;

    expect(yamlLoader.loadDashboardConfig).toHaveBeenCalledOnce();
    expect(logger.debug).toHaveBeenCalledWith(
      '[AppInitializer] Starting dashboard initialization...',
    );
    expect(appService.initializeConfig).toHaveBeenCalledWith(DEFAULT_DASHBOARD_CONFIG);
    expect(logger.info).toHaveBeenCalledWith('[AppInitializer] Dashboard initialized successfully');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('installs defaults and completes when an unexpected loader error escapes', async () => {
    const initError = new Error('load failed');
    yamlLoader.loadDashboardConfig.mockReturnValue(throwError(() => initError));

    const result = TestBed.runInInjectionContext(() => firstValueFrom(initializeDashboard()));

    await expect(result).resolves.toBeUndefined();

    expect(appService.initializeConfig).toHaveBeenCalledOnce();
    expect(appService.initializeConfig).toHaveBeenCalledWith(DEFAULT_DASHBOARD_CONFIG);
    expect(notifications.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(
      '[AppInitializer] Failed to initialize dashboard:',
      initError,
    );
  });
});
