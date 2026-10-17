import { CommonModule, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlassMinus } from '@ng-icons/heroicons/outline';

import { AppService } from '../../../core/services/app.service';
import { SearchService } from '../../../core/services/search.service';
import { SettingsService } from '../../../core/services/settings.service';

import { AppCardComponent } from '../../../shared/components/app-card/app-card.component';
import { AppFinderComponent } from '../../../shared/components/app-finder/app-finder.component';
import { AppCategoriesComponent } from '../../../shared/components/app-categories/app-categories.component';
import { AppLoadingComponent } from '../../../shared/components/app-loading/app-loading.component';
import { AppClockComponent } from '../../../shared/components/app-clock/app-clock.component';
import { AppHeaderComponent } from '../../../shared/components/app-header/app-header.component';
import { StickyDockDirective } from '../../../shared/directives/sticky-dock.directive';
import type { ChromeProbe } from '../../../core/scroll/scroll-state.service';

const DESKTOP_DOCK_QUERY = '(min-width: 601px)';
const DESKTOP_DOCK_MIN_VIEWPORT_HEIGHT = 720;
const MOBILE_DOCK_MIN_VIEWPORT_HEIGHT = 500;
/** The mobile dock only compacts the search bar, 60 → 44 px (design.md § 4.1). */
const MOBILE_DOCK_COMPACT_DELTA = 16;
/** Mirrors `--dock-compact-height` in tokens.css, for when the stylesheet is not there to read. */
const DEFAULT_DOCK_COMPACT_HEIGHT = 284;

@Component({
  selector: 'app-dashboard-horizontal',
  standalone: true,
  imports: [
    CommonModule,
    NgIcon,
    AppHeaderComponent,
    AppFinderComponent,
    AppCategoriesComponent,
    AppCardComponent,
    AppClockComponent,
    AppLoadingComponent,
    StickyDockDirective,
  ],
  templateUrl: 'dashboard-horizontal.component.html',
  viewProviders: [provideIcons({ heroMagnifyingGlassMinus })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class DashboardHorizontalComponent {
  private readonly appService = inject(AppService);
  private readonly searchService = inject(SearchService);
  private readonly settingsService = inject(SettingsService);
  private readonly document = inject(DOCUMENT);

  readonly filteredApps = this.appService.filteredApps;
  readonly searchQuery = this.searchService.searchQuery;

  /** Above 600 px wide the desktop dock is the sticky one; at or below it the mobile dock (search + tabs) is. */
  private readonly desktop = signal(true);
  private readonly dockElement = viewChild<ElementRef<HTMLElement>>('dockEl');
  /** The dock's height in the Top layout, the last one measured before it compacted. */
  private topHeight = 0;

  /** How the desktop dock takes part in the shared scroll state (design.md § 4.1, D13, D14). */
  protected readonly probe: ChromeProbe;

  /** The mobile dock: search bar and tabs only, header and clock scroll away (design.md § 4.1). */
  protected readonly mobileProbe: ChromeProbe;

  constructor() {
    const desktop = this.desktop;
    this.probe = {
      id: 'dashboard-dock',
      compactDelta: () => this.compactDelta(),
      get minViewportHeight() {
        return desktop() ? DESKTOP_DOCK_MIN_VIEWPORT_HEIGHT : Number.POSITIVE_INFINITY;
      },
    };
    this.mobileProbe = {
      id: 'dashboard-mobile-dock',
      compactDelta: () => MOBILE_DOCK_COMPACT_DELTA,
      get minViewportHeight() {
        return desktop() ? Number.POSITIVE_INFINITY : MOBILE_DOCK_MIN_VIEWPORT_HEIGHT;
      },
    };

    const media =
      typeof window.matchMedia === 'function' ? window.matchMedia(DESKTOP_DOCK_QUERY) : null;
    if (media) {
      this.desktop.set(media.matches);
      const onChange = (event: MediaQueryListEvent) => this.desktop.set(event.matches);
      media.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => media.removeEventListener('change', onChange));
    }
  }

  get itemsPerRow(): number {
    return this.settingsService.settings().itemsPerRow;
  }

  /**
   * Height the dock loses when it compacts: its Top-layout height minus the compact-height token. The Top
   * height is only re-measured while the dock is not scrolled, so flipping state never changes Δ.
   */
  private compactDelta(): number {
    const dock = this.dockElement()?.nativeElement;

    if (dock && dock.dataset['dock'] !== 'scrolled') {
      this.topHeight = dock.getBoundingClientRect().height;
    }

    return Math.max(0, Math.round(this.topHeight - this.compactHeight()));
  }

  private compactHeight(): number {
    const root = this.document.documentElement;
    const token = parseFloat(
      this.document.defaultView?.getComputedStyle(root).getPropertyValue('--dock-compact-height') ??
        '',
    );

    return Number.isFinite(token) ? token : DEFAULT_DOCK_COMPACT_HEIGHT;
  }

  /**
   * Handle app click (for tracking/analytics if needed)
   */
  onAppClick(_app: unknown): void {}
}
