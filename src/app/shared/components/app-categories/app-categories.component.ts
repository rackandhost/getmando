import {Component, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {toSignal} from '@angular/core/rxjs-interop';

import { AppService } from '../../../core/services/app.service';
import {CategoryService} from '../../../core/services/category.service';
import {SearchService} from '../../../core/services/search.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'app-categories.component.html',
})
export class AppCategoriesComponent {
  private readonly appService = inject(AppService);
  private readonly categoryService = inject(CategoryService);
  private readonly searchService = inject(SearchService);

  readonly categories = toSignal(this.categoryService.categories$);
  readonly selectedCategory = toSignal(this.categoryService.selectedCategory$);

  get haveSearch(): boolean {
    return this.searchService.haveSearchSubject.value;
  }

  /**
   * Handle category change
   */
  onCategoryChange(categoryId: string): void {
    this.appService.setSelectedCategory(categoryId);
  }
}
