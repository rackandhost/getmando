import { computed, inject, Injectable, signal } from '@angular/core';

import { ConfigService } from './config.service';

import {
  APP_CATEGORY,
  BOOKMARKS_CATEGORY,
  FAVORITES_CATEGORY,
  DEFAULT_DASHBOARD_SEARCH_ENGINES,
  SearchEngine,
  SelfhostedApp,
} from '../models/dashboard.models';

/**
 * Service for managing the search
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private configService = inject(ConfigService);

  private readonly searchQueryState = signal('');
  readonly searchQuery = this.searchQueryState.asReadonly();
  readonly haveSearch = computed(() => this.searchQuery().trim() !== '');
  readonly searchEngines = computed(() =>
    (this.configService.config()?.settings.searchEngines ?? []).map(this.getSearchEngineById),
  );

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
    this.searchQueryState.set(query);
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
      if (categoryId === APP_CATEGORY.id) {
        filtered = apps.filter(({ category }) => category !== BOOKMARKS_CATEGORY.id);
      } else if (categoryId === FAVORITES_CATEGORY.id) {
        filtered = apps.filter((app) => app.favorite);
      } else {
        filtered = apps.filter((app) => app.category === categoryId);
      }
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
