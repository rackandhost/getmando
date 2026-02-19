import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {toSignal} from '@angular/core/rxjs-interop';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {heroChevronDown, heroMagnifyingGlass, heroXMark} from '@ng-icons/heroicons/outline';
import {simpleYoutube, simpleGoogle, simpleDuckduckgo, simpleStartpage} from '@ng-icons/simple-icons';

import {AppService} from '../../../core/services/app.service';
import {SearchService} from '../../../core/services/search.service';

import {SearchEngine} from '../../../core/models/dashboard.models';

@Component({
  selector: 'app-finder',
  standalone: true,
  imports: [CommonModule, NgIcon],
  templateUrl: 'app-finder.component.html',
  viewProviders: [provideIcons({
    heroMagnifyingGlass,
    heroXMark,
    heroChevronDown,
    simpleYoutube,
    simpleGoogle,
    simpleDuckduckgo,
    simpleStartpage
  })],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppFinderComponent {
  private readonly appService = inject(AppService);
  private readonly searchService = inject(SearchService);

  protected readonly searchQuery = signal('');
  protected readonly selectedEngine = signal<SearchEngine | null>(null);
  protected readonly isEngineDropdownOpen = signal(false);

  private readonly searchEngines = toSignal(this.searchService.searchEngines$, {
    initialValue: [],
  });

  protected readonly haveSearch = computed(() => this.searchQuery().trim() !== '');
  protected readonly availableEngines = computed(() => this.searchEngines());
  protected readonly currentEngine = computed(
    () => this.selectedEngine() ?? null,
  );

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

    window.open(engine.searchUrl.replace('{query}', encodeURIComponent(query)), '_blank');
    this.onHandleResetSearch();
  }

  /**
   * Handle reset search
   */
  onHandleResetSearch(): void {
    if (!this.haveSearch()) return;

    this.setSearchQuery('');
  }

  /**
   * Toggle engine dropdown
   */
  onToggleEngineDropdown(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.isEngineDropdownOpen.update((isOpen) => !isOpen);
  }

  /**
   * Select a search engine
   */
  onSelectEngine(engine?: SearchEngine): void {
    this.onHandleResetSearch();

    if (!engine) {
      this.selectedEngine.set(null);
    } else {
      this.selectedEngine.set(engine);
    }

    this.isEngineDropdownOpen.set(false);
  }

  /**
   * Close dropdown
   */
  onCloseDropdown(): void {
    this.isEngineDropdownOpen.set(false);
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
