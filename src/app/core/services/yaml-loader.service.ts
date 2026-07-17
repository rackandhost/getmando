import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, map, Observable, of, retry, tap, throwError, timer } from 'rxjs';

import { YamlParserService } from './yaml-parser.service';
import { LoggerService } from './logger.service';
import { NotificationService } from './notification.service';

import { DashboardConfig } from '../models/dashboard.models';

/**
 * Service for loading YAML configuration from assets
 * Automatically loads from /assets/config/dashboard.yaml
 */
@Injectable({ providedIn: 'root' })
export class YamlLoaderService {
  private readonly http = inject(HttpClient);
  private readonly yamlParser = inject(YamlParserService);
  private readonly logger = inject(LoggerService);
  private readonly notifications = inject(NotificationService);

  private readonly CONFIG_PATH = '/config/dashboard.yaml';

  /**
   * Load dashboard configuration from YAML file
   * @returns Observable of DashboardConfig
   */
  loadDashboardConfig(): Observable<DashboardConfig> {
    return this.http.get(this.CONFIG_PATH, { responseType: 'text' }).pipe(
      retry({
        count: 3,
        delay: (error: unknown, retryCount) =>
          this.isTransientHttpError(error)
            ? timer(250 * 2 ** (retryCount - 1))
            : throwError(() => error),
      }),
      tap(() => {
        this.logger.debug('[YamlLoader] YAML content loaded successfully');
      }),
      // Parse and validate YAML
      map((yamlContent: string) => this.yamlParser.parseYamlOrThrow(yamlContent)),
      // Log success
      tap((config: DashboardConfig) => {
        this.logger.info('[YamlLoader] Dashboard config loaded:', {
          title: config.metadata.title,
          apps: config.applications.length,
          categories: config.categories.length,
        });
      }),
      // Handle errors gracefully
      catchError((error) => {
        this.logger.error('[YamlLoader] Failed to load dashboard config:', error);
        this.logger.warn('[YamlLoader] Falling back to default configuration');
        this.notifications.warning('Dashboard configuration could not be loaded. Using defaults.');
        return of(this.yamlParser.getDefaultConfig());
      }),
    );
  }

  /**
   * Check if the config file exists
   * @returns Observable<boolean>
   */
  configExists(): Observable<boolean> {
    return this.http.head(this.CONFIG_PATH).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  private isTransientHttpError(error: unknown): error is HttpErrorResponse {
    return (
      error instanceof HttpErrorResponse &&
      (error.status === 0 ||
        error.status === 408 ||
        error.status === 429 ||
        (error.status >= 500 && error.status < 600))
    );
  }
}
