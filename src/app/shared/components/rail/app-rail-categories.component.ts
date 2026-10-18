import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AppService } from '../../../core/services/app.service';
import { CategoryService } from '../../../core/services/category.service';
import { SearchService } from '../../../core/services/search.service';
import { ChipAutocenterDirective } from '../../directives/chip-autocenter.directive';
import { HorizontalNavDirective } from '../../directives/horizontal-nav.directive';

/**
 * The rail's category list: a vertical column of buttons from 1024 px, a sideways-scrolling row of the
 * same buttons below it. The selected one is marked by weight, tint, ring and a bar before the label;
 * while a search query is active the list is dimmed, disabled and has no selection. The DOM order is
 * the visual order, no CSS `order`.
 */
@Component({
  selector: 'app-rail-categories',
  imports: [ChipAutocenterDirective, HorizontalNavDirective],
  templateUrl: 'app-rail-categories.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class AppRailCategoriesComponent {
  private readonly appService = inject(AppService);
  private readonly categoryService = inject(CategoryService);

  protected readonly categories = this.categoryService.categories;
  protected readonly selectedCategory = this.categoryService.selectedCategory;
  protected readonly haveSearch = inject(SearchService).haveSearch;

  protected onCategoryChange(categoryId: string): void {
    this.appService.setSelectedCategory(categoryId);
  }
}
