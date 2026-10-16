import { Component, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppService } from '../../../core/services/app.service';
import { CategoryService } from '../../../core/services/category.service';
import { SearchService } from '../../../core/services/search.service';
import { HorizontalNavDirective } from '../../directives/horizontal-nav.directive';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, HorizontalNavDirective],
  templateUrl: 'app-categories.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppCategoriesComponent {
  private readonly appService = inject(AppService);
  private readonly categoryService = inject(CategoryService);
  private readonly searchService = inject(SearchService);

  /** The scrolled dock tightens the tab gap from 28 px to 12 px (design.md § 4.1). */
  readonly compact = input(false);

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
