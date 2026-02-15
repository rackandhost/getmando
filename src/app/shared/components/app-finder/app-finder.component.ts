import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppService } from '../../../core/services/app.service';

@Component({
  selector: 'app-finder',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'app-finder.component.html',
})
export class AppFinderComponent {
  private readonly appService = inject(AppService);

  // Local state for search
  searchQuery = '';

  /**
   * Handle search input
   */
  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery = target.value;
    this.appService.setSearchQuery(this.searchQuery);
  }
}
