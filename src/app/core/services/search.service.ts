import {inject, Injectable} from '@angular/core';
import {BehaviorSubject, map} from 'rxjs';

import {ConfigService} from './config.service';

import {
  APP_CATEGORY,
  BOOKMARKS_CATEGORY,
  DashboardConfig,
  DEFAULT_DASHBOARD_SEARCH_ENGINES,
  SearchEngine,
  SelfhostedApp
} from '../models/dashboard.models';

/**
 * Service for managing the search
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private configService = inject(ConfigService);

  private readonly searchQuerySubject = new BehaviorSubject<string>('');

  haveSearchSubject = new BehaviorSubject<boolean>(false);

  readonly searchEngines$ = this.configService.config$.pipe(
    map((config) => config.settings.searchEngines),
    map((searchEngines) => searchEngines.map(this.getSearchEngineById)),
  );
  readonly searchQuery$ = this.searchQuerySubject.asObservable();

  private get config(): DashboardConfig | undefined {
    return this.configService.subject.value;
  }

  /**
   * Get search engine by ID
   * @param engineId - Search engine ID
   * @returns Search engine or undefined
   */
  getSearchEngineById(engineId: string): SearchEngine | undefined {
    return DEFAULT_DASHBOARD_SEARCH_ENGINES.find((engine) => engine.id === engineId);
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
   * Filter applications based on search query and category
   * @param apps - Applications to filter
   * @param query - Search query
   * @param categoryId - Category ID
   * @param searchAll - Search in all applications and bookmarks
   * @returns Filtered applications
   */
  filterApps(
    apps: SelfhostedApp[],
    query: string,
    categoryId: string,
    searchAll = false,
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
}
