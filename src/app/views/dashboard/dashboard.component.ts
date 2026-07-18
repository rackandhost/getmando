import { Component, effect, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppService } from '../../core/services/app.service';
import { SearchService } from '../../core/services/search.service';
import { SettingsService } from '../../core/services/settings.service';

import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { AppHeaderComponent } from '../../shared/components/app-header/app-header.component';
import { AppFinderComponent } from '../../shared/components/app-finder/app-finder.component';
import { AppCategoriesComponent } from '../../shared/components/app-categories/app-categories.component';
import { AppLoadingComponent } from '../../shared/components/app-loading/app-loading.component';
import { AppFooterComponent } from '../../shared/components/app-footer/app-footer.component';
import { AppClockComponent } from '../../shared/components/app-clock/app-clock.component';
import { ThemeService } from '../../core/services/theme.service';

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
  private readonly searchService = inject(SearchService);
  private readonly settingsService = inject(SettingsService);
  private readonly themeService = inject(ThemeService);

  readonly filteredApps = this.appService.filteredApps;
  readonly searchQuery = this.searchService.searchQuery;

  get itemsPerRow(): number {
    return this.settingsService.settings().itemsPerRow;
  }

  constructor() {
    effect(() => {
      const { lightBackgroundImage, darkBackgroundImage } = this.settingsService.settings();
      this.themeService.currentTheme();
      this.setBackgroundImage({ lightBackgroundImage, darkBackgroundImage });
    });
  }

  /**
   * Handle app click (for tracking/analytics if needed)
   */
  onAppClick(_app: unknown): void {}

  private setBackgroundImage({
    lightBackgroundImage,
    darkBackgroundImage,
  }: {
    lightBackgroundImage: string;
    darkBackgroundImage: string;
  }): void {
    const bgLayer = document.getElementById('app-background');
    if (!bgLayer) return;

    const selectedImage: string = this.themeService.isDarkMode()
      ? darkBackgroundImage
      : lightBackgroundImage;

    const isImageAnUrl = selectedImage.startsWith('https') || selectedImage.startsWith('http');

    bgLayer.style.backgroundImage = `url(${isImageAnUrl ? '' : '/img/'}${selectedImage})`;
  }
}
