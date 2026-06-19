import {TestBed} from '@angular/core/testing';
import {of, throwError} from 'rxjs';

import {initializeDashboard} from './dashboard.initializer';
import {YamlLoaderService} from '../services/yaml-loader.service';
import {AppService} from '../services/app.service';
import {LoggerService} from '../services/logger.service';
import {DEFAULT_DASHBOARD_CONFIG} from '../models/dashboard.models';

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

    TestBed.configureTestingModule({
      providers: [{ provide: LoggerService, useValue: logger }],
    });
  });

  it('should initialize config and log success when the dashboard loads', async () => {
    yamlLoader.loadDashboardConfig.mockReturnValue(of(DEFAULT_DASHBOARD_CONFIG));

    const initializer = TestBed.runInInjectionContext(() =>
      initializeDashboard(yamlLoader as unknown as YamlLoaderService, appService as unknown as AppService),
    );

    await initializer();

    expect(logger.debug).toHaveBeenCalledWith('[AppInitializer] Starting dashboard initialization...');
    expect(appService.initializeConfig).toHaveBeenCalledWith(DEFAULT_DASHBOARD_CONFIG);
    expect(logger.info).toHaveBeenCalledWith('[AppInitializer] Dashboard initialized successfully');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should log and rethrow when dashboard initialization fails', async () => {
    const initError = new Error('load failed');
    yamlLoader.loadDashboardConfig.mockReturnValue(throwError(() => initError));

    const initializer = TestBed.runInInjectionContext(() =>
      initializeDashboard(yamlLoader as unknown as YamlLoaderService, appService as unknown as AppService),
    );

    await expect(initializer()).rejects.toThrow(initError);

    expect(appService.initializeConfig).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('[AppInitializer] Failed to initialize dashboard:', initError);
  });
});
