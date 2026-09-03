import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppService } from '../../core/services/app.service';
import { SearchService } from '../../core/services/search.service';
import { SettingsService } from '../../core/services/settings.service';

import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { AppFinderComponent } from '../../shared/components/app-finder/app-finder.component';
import { AppCategoriesComponent } from '../../shared/components/app-categories/app-categories.component';
import { AppLoadingComponent } from '../../shared/components/app-loading/app-loading.component';
import { AppClockComponent } from '../../shared/components/app-clock/app-clock.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    AppFinderComponent,
    AppCategoriesComponent,
    AppCardComponent,
    AppClockComponent,
    AppLoadingComponent,
  ],
  templateUrl: 'dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class DashboardComponent {
  private readonly appService = inject(AppService);
  private readonly searchService = inject(SearchService);
  private readonly settingsService = inject(SettingsService);

  readonly filteredApps = this.appService.filteredApps;
  readonly searchQuery = this.searchService.searchQuery;

  get itemsPerRow(): number {
    return this.settingsService.settings().itemsPerRow;
  }

  /**
   * Handle app click (for tracking/analytics if needed)
   */
  onAppClick(_app: unknown): void {}
}
