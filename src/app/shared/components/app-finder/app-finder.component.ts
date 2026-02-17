import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlass, heroXMark } from '@ng-icons/heroicons/outline';

import { AppService } from '../../../core/services/app.service';

@Component({
  selector: 'app-finder',
  standalone: true,
  imports: [CommonModule, NgIcon],
  templateUrl: 'app-finder.component.html',
  viewProviders: [provideIcons({ heroMagnifyingGlass, heroXMark })]
})
export class AppFinderComponent {
  private readonly appService = inject(AppService);

  // Local state for search
  searchQuery = '';

  get haveSearch(): boolean {
    return this.searchQuery.trim() !== '';
  }

  /**
   * Handle search input
   */
  onSearchInput(event: Event): void {
    const { value } = event.target as HTMLInputElement;

    this.setAndEmitSearchQuery(value);
  }

  onHandleResetSearch(): void {
    if (!this.haveSearch) return;

    this.setAndEmitSearchQuery('');
  }

  private setAndEmitSearchQuery(newValue: string): void {
    this.searchQuery = newValue;
    this.appService.setSearchQuery(this.searchQuery);
  }
}
