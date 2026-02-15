import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppService } from '../../../core/services/app.service';
import { ThemeService } from '../../../core/services/theme.service';

import { AppCardComponent } from '../../../shared/components/app-card/app-card.component';
import { AppHeaderComponent } from '../../../shared/components/app-header/app-header.component';
import { AppFinderComponent } from '../../../shared/components/app-finder/app-finder.component';
import { AppCategoriesComponent } from '../../../shared/components/app-categories/app-categories.component';
import { AppLoadingComponent } from '../../../shared/components/app-loading/app-loading.component';
import { AppFooterComponent } from '../../../shared/components/app-footer/app-footer.component';
import { AppClockComponent } from '../../../shared/components/app-clock/app-clock.component';

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
  readonly themeService = inject(ThemeService);

  // Observable streams
  readonly filteredApps$ = this.appService.filteredApps$;
  readonly searchQuery$ = this.appService.searchQuery$;
  readonly isDark$ = this.themeService.isDark$;

  get itemsPerRow(): number {
    return this.appService.settingsSubject.value.itemsPerRow;
  }

  /**
   * Handle app click (for tracking/analytics if needed)
   */
  onAppClick(app: unknown): void {
    console.log('[Dashboard] App clicked:', app);
  }
}
