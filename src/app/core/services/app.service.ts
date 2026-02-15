import { Injectable, computed, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, tap, distinctUntilChanged, filter } from 'rxjs/operators';

import {
  DashboardConfig,
  SelfhostedApp,
  Category,
  SearchEngine,
  DashboardSettings,
  DEFAULT_DASHBOARD_CONFIG,
  APP_CATEGORY,
  BOOKMARKS_CATEGORY,
} from '../models/dashboard.models';

import { YamlLoaderService } from './yaml-loader.service';

/**
 * Service for managing dashboard application state
 * Uses BehaviorSubjects for reactive state management
 */
@Injectable({ providedIn: 'root' })
export class AppService {
  private yamlLoader = inject(YamlLoaderService);

  private configSubject = new BehaviorSubject<DashboardConfig | undefined>(undefined);
  private readonly searchQuerySubject = new BehaviorSubject<string>('');
  private readonly selectedCategorySubject = new BehaviorSubject<string>(APP_CATEGORY.id);

  settingsSubject = new BehaviorSubject<DashboardSettings>(DEFAULT_DASHBOARD_CONFIG.settings);
  haveSearchSubject = new BehaviorSubject<boolean>(false);

  appVersion = '0.1.0-beta';

  /**
   * Observable streams for component consumption
   */
  readonly config$ = this.configSubject.asObservable().pipe(filter((config) => !!config));
  readonly apps$ = this.config$.pipe(
    tap((config) => {
      if (!config.settings.showAllCategory) {
        this.selectedCategorySubject.next(config.categories[0].id);
      }
    }),
    map((config) => [
      ...config.applications,
      ...(config.settings.allowBookmarks
        ? config.bookmarks.map((bookmark) => ({
            ...bookmark,
            category: BOOKMARKS_CATEGORY.id,
          }))
        : []
      ).sort((a, b) => a.name.localeCompare(b.name)),
    ]),
  );
  readonly bookmarks$ = this.config$.pipe(map((config) => config.bookmarks));
  readonly categories$ = this.config$.pipe(
    map((config) => {
      const categories: Category[] = [];

      if (config.settings.showAllCategory) {
        categories.push(APP_CATEGORY);
      }

      if (config.settings.allowBookmarks) {
        categories.push(BOOKMARKS_CATEGORY);
      }

      return [...categories, ...config.categories].sort((a, b) => a.name.localeCompare(b.name));
    }),
  );
  readonly searchEngines$ = this.config$.pipe(map((config) => config.searchEngines));
  readonly settings$ = this.config$.pipe(map((config) => config.settings));
  readonly metadata$ = this.config$.pipe(map((config) => config.metadata));
  readonly searchQuery$ = this.searchQuerySubject.asObservable();
  readonly selectedCategory$ = this.selectedCategorySubject.asObservable();

  constructor() {
    this.yamlLoader.loadDashboardConfig().subscribe((config) => this.configSubject.next(config));
    this.settings$.subscribe((settings) => this.settingsSubject.next(settings));
  }

  /**
   * Computed: Filtered apps based on search and category
   */
  readonly filteredApps$: Observable<SelfhostedApp[]> = combineLatest([
    this.apps$,
    this.searchQuery$,
    this.selectedCategory$,
  ]).pipe(
    map(([apps, query, category]) => this.filterApps(apps, query, category, query.trim() !== '')),
    distinctUntilChanged(),
  );

  /**
   * Current config value (synchronous access)
   */
  get config(): DashboardConfig | undefined {
    return this.configSubject.value;
  }

  /**
   * Initialize with dashboard configuration
   * @param config - Dashboard configuration
   */
  initializeConfig(config: DashboardConfig): void {
    this.configSubject.next(config);
    console.log('[AppService] Dashboard config initialized');
  }

  /**
   * Update search query
   * @param query - Search query string
   */
  setSearchQuery(query: string): void {
    this.searchQuerySubject.next(query);
    this.haveSearchSubject.next(query.trim() !== '');
  }

  /**
   * Update selected category
   * @param categoryId - Category ID
   */
  setSelectedCategory(categoryId: string): void {
    this.selectedCategorySubject.next(categoryId);
  }

  /**
   * Get app by ID
   * @param appId - Application ID
   * @returns Application or undefined
   */
  getAppById(appId: string): SelfhostedApp | undefined {
    if (!this.config) return;

    return this.config.applications.find((app) => app.id === appId);
  }

  /**
   * Get search engine by ID
   * @param engineId - Search engine ID
   * @returns Search engine or undefined
   */
  getSearchEngineById(engineId: string): SearchEngine | undefined {
    if (!this.config) return;

    return this.config.searchEngines.find((engine) => engine.id === engineId);
  }

  /**
   * Get apps by category
   * @param categoryId - Category ID
   * @returns Array of applications
   */
  getAppsByCategory(categoryId: string): SelfhostedApp[] {
    if (!this.config) return [];

    if (categoryId === APP_CATEGORY.id) {
      return this.config.applications;
    }
    return this.config.applications.filter((app) => app.category === categoryId);
  }

  /**
   * Filter applications based on search query and category
   * @param apps - Applications to filter
   * @param query - Search query
   * @param categoryId - Category ID
   * @returns Filtered applications
   */
  private filterApps(
    apps: SelfhostedApp[],
    query: string,
    categoryId: string,
    searchAll: boolean = false,
  ): SelfhostedApp[] {
    let filtered = [];

    if (searchAll) {
      filtered = apps;
    } else {
      filtered =
        categoryId === APP_CATEGORY.id
          ? apps.filter(({ category }) => category !== BOOKMARKS_CATEGORY.id)
          : apps.filter((app) => app.category === categoryId);
    }

    if (!query.trim()) {
      return filtered;
    }

    const lowerQuery = query.toLowerCase();
    return filtered.filter(
      (app) =>
        app.name.toLowerCase().includes(lowerQuery) ||
        app.description.toLowerCase().includes(lowerQuery) ||
        app.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)),
    );
  }

  /**
   * Get app count by category
   * @param categoryId - Category ID
   * @returns Number of applications in category
   */
  getAppCountByCategory(categoryId: string): number {
    return this.getAppsByCategory(categoryId).length;
  }
}
