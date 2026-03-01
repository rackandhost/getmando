import {Component, inject, ChangeDetectionStrategy} from '@angular/core';
import {CommonModule} from '@angular/common';

import {AppService} from '../../core/services/app.service';
import {ThemeService} from '../../core/services/theme.service';
import {SearchService} from '../../core/services/search.service';
import {SettingsService} from '../../core/services/settings.service';

import {AppCardComponent} from '../../shared/components/app-card/app-card.component';
import {AppHeaderComponent} from '../../shared/components/app-header/app-header.component';
import {AppFinderComponent} from '../../shared/components/app-finder/app-finder.component';
import {AppCategoriesComponent} from '../../shared/components/app-categories/app-categories.component';
import {AppLoadingComponent} from '../../shared/components/app-loading/app-loading.component';
import {AppFooterComponent} from '../../shared/components/app-footer/app-footer.component';
import {AppClockComponent} from '../../shared/components/app-clock/app-clock.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    AppHeaderComponent,
    AppFinderComponent,
    AppCategoriesComponent,
    AppCardComponent,
    AppClockComponent,
    AppLoadingComponent,
    AppFooterComponent,
  ],
  templateUrl: 'dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly appService = inject(AppService);
  private readonly themeService = inject(ThemeService);
  private readonly searchService = inject(SearchService);
  private readonly settingsService = inject(SettingsService);

  // Observable streams
  readonly filteredApps$ = this.appService.filteredApps$;
  readonly searchQuery$ = this.searchService.searchQuery$;
  readonly settings$ = this.settingsService.settings$;
  readonly isDark$ = this.themeService.isDark$;

  get itemsPerRow(): number {
    return this.settingsService.settingsSubject.value.itemsPerRow;
  }

  constructor() {
    this.settings$.subscribe(({ backgroundImage }) => this.setBackgroundImage(backgroundImage));
  }

  /**
   * Handle app click (for tracking/analytics if needed)
   */
  onAppClick(app: unknown): void {
    console.log('[Dashboard] App clicked:', app);
  }

  private setBackgroundImage(image: string): void {
    const body$ = document.getElementsByTagName('body')[0];

    body$.style.backgroundImage = `url(/img/${image})`;
  }
}
