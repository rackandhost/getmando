import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {catchError, map, Observable, of, tap} from 'rxjs';

import {YamlParserService} from './yaml-parser.service';

import {DashboardConfig} from '../models/dashboard.models';

/**
 * Service for loading YAML configuration from assets
 * Automatically loads from /assets/config/dashboard.yaml
 */
@Injectable({ providedIn: 'root' })
export class YamlLoaderService {
  private readonly http = inject(HttpClient);
  private readonly yamlParser = inject(YamlParserService);

  private readonly CONFIG_PATH = '/config/dashboard.yaml';

  /**
   * Load dashboard configuration from YAML file
   * @returns Observable of DashboardConfig
   */
  loadDashboardConfig(): Observable<DashboardConfig> {
    return this.http.get(this.CONFIG_PATH, { responseType: 'text' }).pipe(
      tap(() => {
        console.log('[YamlLoader] YAML content loaded successfully');
      }),
      // Parse and validate YAML
      map((yamlContent: string) => this.yamlParser.parseYamlOrThrow(yamlContent)),
      // Log success
      tap((config: DashboardConfig) => {
        console.log('[YamlLoader] Dashboard config loaded:', {
          title: config.metadata.title,
          apps: config.applications.length,
          categories: config.categories.length
        });
      }),
      // Handle errors gracefully
      catchError((error) => {
        console.error('[YamlLoader] Failed to load dashboard config:', error);
        console.log('[YamlLoader] Falling back to default configuration');
        return of(this.yamlParser.getDefaultConfig());
      }),
    );
  }

  /**
   * Load dashboard configuration with explicit error handling
   * @returns Observable of DashboardConfig
   */
  loadDashboardConfigWithFallback(): Observable<DashboardConfig> {
    return this.loadDashboardConfig().pipe(
      catchError((error) => {
        console.error('[YamlLoader] All attempts failed, using default config:', error);
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
}
