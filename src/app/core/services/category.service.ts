import {inject, Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {map} from 'rxjs/operators';

import {APP_CATEGORY, BOOKMARKS_CATEGORY, FAVORITES_CATEGORY, Category} from '../models/dashboard.models';

import {ConfigService} from './config.service';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private configService = inject(ConfigService);

  private readonly selectedCategorySubject = new BehaviorSubject<string>(APP_CATEGORY.id);

  readonly categories$ = this.configService.config$.pipe(
    map((config) => {
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

      return [
        ...categories,
        ...config.categories.sort((a, b) => a.name.localeCompare(b.name)),
      ];
    }),
  );
  readonly selectedCategory$ = this.selectedCategorySubject.asObservable();

  constructor() {
    this.categories$.subscribe((categories) => {
      const ids = categories.map((c) => c.id);
      if (!ids.includes(this.selectedCategorySubject.value) && categories.length > 0) {
        this.selectedCategorySubject.next(categories[0].id);
      }
    });
  }

  /**
   * Update selected category
   * @param categoryId - Category ID
   */
  setSelectedCategory(categoryId: string): void {
    this.selectedCategorySubject.next(categoryId);
  }
}
