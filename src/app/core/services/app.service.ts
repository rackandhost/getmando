import {Injectable, inject} from '@angular/core';
import {Observable, combineLatest} from 'rxjs';
import {map, tap, distinctUntilChanged} from 'rxjs/operators';

import {
  DashboardConfig,
  SelfhostedApp,
  APP_CATEGORY,
  BOOKMARKS_CATEGORY,
} from '../models/dashboard.models';

import {YamlLoaderService} from './yaml-loader.service';
import {ConfigService} from './config.service';
import {SearchService} from './search.service';
import {CategoryService} from './category.service';
import {BookmarkService} from './bookmark.service';

/**
 * Service for managing dashboard application state
 * Uses BehaviorSubjects for reactive state management
 */
@Injectable({ providedIn: 'root' })
export class AppService {
  private configService = inject(ConfigService);
  private yamlLoader = inject(YamlLoaderService);
  private searchService = inject(SearchService);
  private categoryService = inject(CategoryService);
  private bookmarkService = inject(BookmarkService);

  appVersion = '0.1.1-beta';

  /**
   * Observable streams for component consumption
   */
  readonly apps$ = this.configService.config$.pipe(
    tap((config) => {
      if (!config.settings.showAllCategory) {
        this.categoryService.setSelectedCategory(config.categories[0].id);
      }
    }),
    map((config) => [
      ...config.applications,
      ...(config.settings.allowBookmarks
        ? this.bookmarkService.bookmarks.map((bookmark) => ({
            ...bookmark,
            category: BOOKMARKS_CATEGORY.id,
          }))
        : []
      ).sort((a, b) => a.name.localeCompare(b.name)),
    ]),
  );


  constructor() {
    this.yamlLoader.loadDashboardConfig().subscribe((config) => this.configService.fireNewSubject(config));
  }

  /**
   * Computed: Filtered apps based on search and category
   */
  readonly filteredApps$: Observable<SelfhostedApp[]> = combineLatest([
    this.apps$,
    this.searchService.searchQuery$,
    this.categoryService.selectedCategory$,
  ]).pipe(
    map(([apps, query, category]) => this.searchService.filterApps(apps, query, category, query.trim() !== '')),
    distinctUntilChanged(),
  );

  /**
   * Current config value (synchronous access)
   */
  get config(): DashboardConfig | undefined {
    return this.configService.subject.value;
  }

  /**
   * Initialize with dashboard configuration
   * @param config - Dashboard configuration
   */
  initializeConfig(config: DashboardConfig): void {
    this.configService.subject.next(config);
    console.log('[AppService] Dashboard config initialized');
  }

  /**
   * Update search query
   * @param query - Search query string
   */
  setSearchQuery(query: string): void {
    this.searchService.setSearchQuery(query);
  }

  /**
   * Update selected category
   * @param categoryId - Category ID
   */
  setSelectedCategory(categoryId: string): void {
    this.categoryService.setSelectedCategory(categoryId);
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
}
