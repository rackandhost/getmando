import { inject } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';

import { YamlLoaderService } from '../services/yaml-loader.service';
import { AppService } from '../services/app.service';
import { LoggerService } from '../services/logger.service';
import { NotificationService } from '../services/notification.service';
import { DEFAULT_DASHBOARD_CONFIG } from '../models/dashboard.models';

/**
 * Loads and installs dashboard configuration before root bootstrap completes.
 */
export function initializeDashboard(): Observable<void> {
  const yamlLoader = inject(YamlLoaderService);
  const appService = inject(AppService);
  const logger = inject(LoggerService);
  const notifications = inject(NotificationService);

  logger.debug('[AppInitializer] Starting dashboard initialization...');
  return yamlLoader.loadDashboardConfig().pipe(
    tap((config) => {
      appService.initializeConfig(config);
      logger.info('[AppInitializer] Dashboard initialized successfully');
    }),
    map(() => undefined),
    catchError((error) => {
      logger.error('[AppInitializer] Failed to initialize dashboard:', error);
      notifications.error('Dashboard startup failed. Using defaults.');
      appService.initializeConfig(DEFAULT_DASHBOARD_CONFIG);
      return of(undefined);
    }),
  );
}
