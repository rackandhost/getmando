import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {toSignal} from '@angular/core/rxjs-interop';

import { AppService } from '../../../core/services/app.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'app-categories.component.html',
})
export class AppCategoriesComponent {
  private readonly appService = inject(AppService);

  readonly categories = toSignal(this.appService.categories$);
  readonly selectedCategory = toSignal(this.appService.selectedCategory$);

  get haveSearch(): boolean {
    return this.appService.haveSearchSubject.value;
  }

  /**
   * Handle category change
   */
  onCategoryChange(categoryId: string): void {
    this.appService.setSelectedCategory(categoryId);
  }
}
