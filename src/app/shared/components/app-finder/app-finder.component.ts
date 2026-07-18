import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowRight, heroXMark } from '@ng-icons/heroicons/outline';

import { AppService } from '../../../core/services/app.service';
import { SearchService } from '../../../core/services/search.service';

import { SearchEngine } from '../../../core/models/dashboard.models';
import { AppSearchEngineSelectorComponent } from '../app-search-engine-selector/app-search-engine-selector.component';

@Component({
  selector: 'app-finder',
  imports: [NgIcon, AppSearchEngineSelectorComponent],
  templateUrl: 'app-finder.component.html',
  viewProviders: [
    provideIcons({
      heroXMark,
      heroArrowRight,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppFinderComponent {
  private readonly appService = inject(AppService);
  private readonly searchService = inject(SearchService);

  protected readonly searchQuery = signal('');
  protected readonly selectedEngine = signal<SearchEngine | null>(null);

  protected readonly haveSearch = computed(() => this.searchQuery().trim() !== '');
  protected readonly availableEngines = computed(() => this.searchService.searchEngines());
  protected readonly currentEngine = computed(() => this.selectedEngine() ?? null);

  get inputPlaceholder(): string {
    if (this.currentEngine()) {
      return `Search on the web... (press enter to search on ${this.currentEngine()?.name})`;
    }

    return 'Search on your applications...';
  }

  /**
   * Handle search input
   */
  onSearchInput(event: Event): void {
    const { value } = event.target as HTMLInputElement;

    this.setSearchQuery(value);
  }

  /**
   * Handle Enter key press
   */
  onSearchEnter(): void {
    const query = this.searchQuery().trim();
    const engine = this.currentEngine();

    if (!query || !engine) return;

    const openedWindow = window.open(
      engine.searchUrl.replace('{query}', encodeURIComponent(query)),
      '_blank',
    );

    if (openedWindow) this.onHandleResetSearch();
  }

  /**
   * Handle reset search
   */
  onHandleResetSearch(): void {
    if (!this.haveSearch()) return;

    this.setSearchQuery('');
  }

  /**
   * Select a search engine
   */
  onSelectEngine(engine: SearchEngine | null): void {
    this.onHandleResetSearch();

    this.selectedEngine.set(engine);
  }

  /**
   * Set search query
   */
  private setSearchQuery(newValue: string): void {
    this.searchQuery.set(newValue);

    if (!this.currentEngine()) {
      this.appService.setSearchQuery(newValue);
    }
  }
}
