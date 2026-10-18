import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlassMinus } from '@ng-icons/heroicons/outline';

import { AppService } from '../../../core/services/app.service';
import { CategoryService } from '../../../core/services/category.service';
import { SearchService } from '../../../core/services/search.service';

import { AppCardComponent } from '../../../shared/components/app-card/app-card.component';
import { AppFinderComponent } from '../../../shared/components/app-finder/app-finder.component';
import { AppFooterComponent } from '../../../shared/components/app-footer/app-footer.component';
import { AppLoadingComponent } from '../../../shared/components/app-loading/app-loading.component';
import { AppRailActionsComponent } from '../../../shared/components/rail/app-rail-actions.component';
import { AppRailBrandComponent } from '../../../shared/components/rail/app-rail-brand.component';
import { AppRailCategoriesComponent } from '../../../shared/components/rail/app-rail-categories.component';
import { AppRailClockComponent } from '../../../shared/components/rail/app-rail-clock.component';
import { AppRailComponent } from '../../../shared/components/rail/app-rail.component';

/**
 * The dashboard with the vertical layout: a rail on the side (a bar on top below 1024 px) with the brand,
 * clock, search, categories and actions, and the applications in an adaptive grid beside it. Nothing here
 * changes with the scroll position, and `itemsPerRow` does not apply: the grid fits as many 270 px
 * columns as the width allows.
 */
@Component({
  selector: 'app-dashboard-vertical',
  imports: [
    NgIcon,
    AppCardComponent,
    AppFinderComponent,
    AppFooterComponent,
    AppLoadingComponent,
    AppRailActionsComponent,
    AppRailBrandComponent,
    AppRailCategoriesComponent,
    AppRailClockComponent,
    AppRailComponent,
  ],
  templateUrl: 'dashboard-vertical.component.html',
  viewProviders: [provideIcons({ heroMagnifyingGlassMinus })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class DashboardVerticalComponent {
  private readonly categoryService = inject(CategoryService);
  private readonly searchService = inject(SearchService);

  protected readonly filteredApps = inject(AppService).filteredApps;
  protected readonly searchQuery = this.searchService.searchQuery;

  /** The selected category's name, or `Results` while a query is active. */
  protected readonly heading = computed(() => {
    if (this.searchService.haveSearch()) return 'Results';

    const selected = this.categoryService.selectedCategory();
    return (
      this.categoryService.categories().find((category) => category.id === selected)?.name ?? ''
    );
  });

  /** `N item` / `N items`; nothing while the applications are still loading. */
  protected readonly count = computed(() => {
    const total = this.filteredApps()?.length;
    return total === undefined ? null : `${total} ${total === 1 ? 'item' : 'items'}`;
  });
}
