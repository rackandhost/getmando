import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
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

  /** `bar`: the horizontal layout's search bar. `rail`: the vertical layout's fixed 48 px field. */
  readonly variant = input<'bar' | 'rail'>('bar');

  /** The scrolled dock shrinks the bar to 44 px / 440 px wide (design.md § 4.1). The rail ignores it. */
  readonly compact = input(false);

  protected readonly inputFocused = signal(false);
  protected readonly menuOpen = signal(false);

  /** Only the bar has a scrolled-dock state: the rail field keeps its size on scroll and focus. */
  protected readonly dockCompact = computed(() => this.variant() === 'bar' && this.compact());

  /** Compact bars grow back while the input has focus, a query is typed or the engine menu is open. */
  protected readonly expanded = computed(
    () => this.dockCompact() && (this.inputFocused() || this.haveSearch() || this.menuOpen()),
  );

  /** Which of the bar's three sizes is showing; the buttons inside scale with it (see the template). */
  protected readonly size = computed<'full' | 'compact' | 'expanded'>(() => {
    if (!this.dockCompact()) return 'full';
    return this.expanded() ? 'expanded' : 'compact';
  });

  protected readonly barSize = computed(() => {
    switch (this.size()) {
      case 'full':
        return 'mx-auto mb-7 h-[60px] max-w-full';
      case 'expanded':
        return 'mx-auto mb-3 h-[52px] max-w-full';
      case 'compact':
        return 'mx-auto mb-3 h-11 max-w-[440px]';
    }
  });

  /** What differs between the two variants: surface, radius, spacing and the focus halo. */
  protected readonly variantClass = computed(() =>
    this.variant() === 'rail'
      ? 'glass-field h-12 gap-1 rounded-[14px] px-1 has-[input:focus-visible]:shadow-[0_0_0_2px_var(--focus-halo)]'
      : `glass-chrome gap-2 rounded-2xl pr-2 pl-1.5 max-[601px]:mb-3 has-[input:focus-visible]:shadow-[var(--glass-shadow),0_0_0_2px_var(--focus-halo)] ${this.barSize()}`,
  );

  protected onFocusIn(event: FocusEvent): void {
    if (event.target instanceof HTMLInputElement) this.inputFocused.set(true);
  }

  /** Focus moving to the engine or clear button inside the bar is not leaving it, so the bar keeps its size. */
  protected onFocusOut(event: FocusEvent): void {
    const bar = event.currentTarget as HTMLElement;

    if (!(event.relatedTarget instanceof Node) || !bar.contains(event.relatedTarget)) {
      this.inputFocused.set(false);
    }
  }

  get inputPlaceholder(): string {
    const engine = this.currentEngine();

    return engine ? `Search on ${engine.name}…` : 'Search your applications…';
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
