import {Component, inject, ChangeDetectionStrategy, OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {combineLatest, Subject, takeUntil} from 'rxjs';

import {AppService} from '../../core/services/app.service';
import {SearchService} from '../../core/services/search.service';
import {SettingsService} from '../../core/services/settings.service';

import {AppCardComponent} from '../../shared/components/app-card/app-card.component';
import {AppHeaderComponent} from '../../shared/components/app-header/app-header.component';
import {AppFinderComponent} from '../../shared/components/app-finder/app-finder.component';
import {AppCategoriesComponent} from '../../shared/components/app-categories/app-categories.component';
import {AppLoadingComponent} from '../../shared/components/app-loading/app-loading.component';
import {AppFooterComponent} from '../../shared/components/app-footer/app-footer.component';
import {AppClockComponent} from '../../shared/components/app-clock/app-clock.component';
import {ThemeService} from '../../core/services/theme.service';

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
export class DashboardComponent implements OnDestroy {
  private readonly appService = inject(AppService);
  private readonly searchService = inject(SearchService);
  private readonly settingsService = inject(SettingsService);
  private readonly themeService = inject(ThemeService);

  private destroy$: Subject<void> = new Subject<void>();

  // Observable streams
  readonly filteredApps$ = this.appService.filteredApps$;
  readonly searchQuery$ = this.searchService.searchQuery$;
  readonly settings$ = this.settingsService.settings$;
  readonly theme$ = this.themeService.themeSubject;

  get itemsPerRow(): number {
    return this.settingsService.settingsSubject.value.itemsPerRow;
  }

  constructor() {
    combineLatest([
      this.settings$,
      this.theme$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([{ lightBackgroundImage, darkBackgroundImage }]) =>
        this.setBackgroundImage({ lightBackgroundImage, darkBackgroundImage })
      );
  }

  /**
   * Handle app click (for tracking/analytics if needed)
   */
  onAppClick(app: unknown): void {
    console.log('[Dashboard] App clicked:', app);
  }

  private setBackgroundImage(
    { lightBackgroundImage, darkBackgroundImage }: { lightBackgroundImage: string, darkBackgroundImage: string }
  ): void {
    const body$ = document.getElementsByTagName('body')[0];

    const selectedImage: string = this.themeService.isDarkMode() ? darkBackgroundImage : lightBackgroundImage;

    const isImageAnUrl = selectedImage.startsWith('https') || selectedImage.startsWith('http');

    body$.style.backgroundImage = `url(${isImageAnUrl ? '' : '/img/' }${selectedImage})`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
  }
}
