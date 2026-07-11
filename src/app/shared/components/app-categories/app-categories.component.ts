import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppService } from '../../../core/services/app.service';
import { CategoryService } from '../../../core/services/category.service';
import { SearchService } from '../../../core/services/search.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'app-categories.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppCategoriesComponent {
  private readonly appService = inject(AppService);
  private readonly categoryService = inject(CategoryService);
  private readonly searchService = inject(SearchService);

  readonly categories = this.categoryService.categories;
  readonly selectedCategory = this.categoryService.selectedCategory;
  readonly haveSearch = this.searchService.haveSearch;

  /**
   * Handle category change
   */
  onCategoryChange(categoryId: string): void {
    this.appService.setSelectedCategory(categoryId);
  }
}
