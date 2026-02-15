import { APP_INITIALIZER, Provider } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { YamlLoaderService } from '../services/yaml-loader.service';
import { AppService } from '../services/app.service';

/**
 * Factory function to initialize dashboard configuration
 * @param yamlLoader - YamlLoaderService instance
 * @param appService - AppService instance
 * @returns Function that returns a promise when initialization is complete
 */
export function initializeDashboard(
  yamlLoader: YamlLoaderService,
  appService: AppService,
): () => Promise<void> {
  return async () => {
    console.log('[AppInitializer] Starting dashboard initialization...');

    return firstValueFrom(yamlLoader.loadDashboardConfig())
      .then((config) => {
        appService.initializeConfig(config);
        console.log('[AppInitializer] Dashboard initialized successfully');
      })
      .catch((error) => {
        console.error('[AppInitializer] Failed to initialize dashboard:', error);
        throw error;
      });
  };
}

/**
 * Provider for APP_INITIALIZER to load dashboard config on app start
 */
export const DASHBOARD_INITIALIZER_PROVIDER: Provider = {
  provide: APP_INITIALIZER,
  useFactory: initializeDashboard,
  deps: [YamlLoaderService, AppService],
  multi: true,
};
