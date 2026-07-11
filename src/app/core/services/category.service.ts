import { computed, effect, inject, Injectable, signal } from '@angular/core';

import {
  APP_CATEGORY,
  BOOKMARKS_CATEGORY,
  FAVORITES_CATEGORY,
  Category,
} from '../models/dashboard.models';

import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private configService = inject(ConfigService);

  private readonly selectedCategoryState = signal(APP_CATEGORY.id);
  readonly selectedCategory = this.selectedCategoryState.asReadonly();
  readonly categories = computed(() => {
    const config = this.configService.config();
    if (!config) return [];
    const categories: Category[] = [];

    if (config.applications.some((app) => app.favorite)) {
      categories.push(FAVORITES_CATEGORY);
    }

    if (config.settings.showAllCategory) {
      categories.push(APP_CATEGORY);
    }

    if (config.settings.allowBookmarks) {
      categories.push(BOOKMARKS_CATEGORY);
    }

    return [...categories, ...config.categories.sort((a, b) => a.name.localeCompare(b.name))];
  });

  constructor() {
    effect(() => {
      const categories = this.categories();
      const ids = categories.map((c) => c.id);
      if (!ids.includes(this.selectedCategory()) && categories.length > 0) {
        this.selectedCategoryState.set(categories[0].id);
      }
    });
  }

  /**
   * Update selected category
   * @param categoryId - Category ID
   */
  setSelectedCategory(categoryId: string): void {
    this.selectedCategoryState.set(categoryId);
  }
}
