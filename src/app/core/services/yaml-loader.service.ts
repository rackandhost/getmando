import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, retry, shareReplay, tap, throwError, timer } from 'rxjs';

import { DashboardConfig } from '../models/dashboard.models';

import { LoggerService } from './logger.service';
import { NotificationService } from './notification.service';
import { ParseError, YamlParserService } from './yaml-parser.service';

export type MountedConfigResult =
  | { readonly status: 'valid'; readonly config: DashboardConfig }
  | { readonly status: 'missing' }
  | { readonly status: 'invalid'; readonly errors: readonly ParseError[] }
  | { readonly status: 'unavailable'; readonly message: string };

/** Loads the mounted dashboard YAML while preserving its startup outcome for the configurator. */
@Injectable({ providedIn: 'root' })
export class YamlLoaderService {
  private readonly http = inject(HttpClient);
  private readonly yamlParser = inject(YamlParserService);
  private readonly logger = inject(LoggerService);
  private readonly notifications = inject(NotificationService);
  private readonly configPath = '/config/dashboard.yaml';
  private readonly mountedResultState = signal<MountedConfigResult | undefined>(undefined);
  private mountedRequest?: Observable<MountedConfigResult>;

  readonly mountedConfigResult = this.mountedResultState.asReadonly();

  /** Returns and caches the result of the single mounted-config startup request. */
  loadMountedConfig(): Observable<MountedConfigResult> {
    if (!this.mountedRequest) {
      this.mountedRequest = this.http.get(this.configPath, { responseType: 'text' }).pipe(
        retry({
          count: 3,
          delay: (error: unknown, retryCount) =>
            this.isTransientHttpError(error)
              ? timer(250 * 2 ** (retryCount - 1))
              : throwError(() => error),
        }),
        tap(() => this.logger.debug('[YamlLoader] YAML content loaded successfully')),
        map((content) => ({
          status: 'valid' as const,
          config: this.yamlParser.parseYamlOrThrow(content),
        })),
        tap(({ config }) =>
          this.logger.info('[YamlLoader] Dashboard config loaded:', {
            title: config.metadata.title,
            apps: config.applications.length,
            categories: config.categories.length,
          }),
        ),
        catchError((error: unknown) => {
          this.logger.error('[YamlLoader] Failed to load dashboard config:', error);
          return of(this.toMountedResult(error));
        }),
        tap((result) => this.mountedResultState.set(result)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.mountedRequest;
  }

  /** Loads the dashboard configuration, retaining legacy fallback and notification behavior. */
  loadDashboardConfig(): Observable<DashboardConfig> {
    return this.loadMountedConfig().pipe(
      map((result) => {
        if (result.status === 'valid') return result.config;
        this.logger.warn('[YamlLoader] Falling back to default configuration');
        this.notifications.warning('Dashboard configuration could not be loaded. Using defaults.');
        return this.yamlParser.getDefaultConfig();
      }),
    );
  }

  configExists(): Observable<boolean> {
    return this.http.head(this.configPath).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  private toMountedResult(error: unknown): MountedConfigResult {
    if (error instanceof HttpErrorResponse && error.status === 404) return { status: 'missing' };
    if (error instanceof HttpErrorResponse) {
      return { status: 'unavailable', message: 'The mounted configuration is unavailable.' };
    }
    return {
      status: 'invalid',
      errors: [{ path: [], message: error instanceof Error ? error.message : 'Invalid YAML.' }],
    };
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
