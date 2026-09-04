import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowLeft, heroCog6Tooth, heroMoon, heroSun } from '@ng-icons/heroicons/outline';
import { filter, map } from 'rxjs';

import { ThemeService } from '../../../core/services/theme.service';
import { MetadataService } from '../../../core/services/metadata.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule, NgIcon, RouterLink],
  templateUrl: 'app-header.component.html',
  viewProviders: [provideIcons({ heroArrowLeft, heroCog6Tooth, heroMoon, heroSun })],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  private readonly themeService = inject(ThemeService);
  private readonly metadataService = inject(MetadataService);
  private readonly router = inject(Router);

  readonly metadata = this.metadataService.metadata;

  readonly themeIcon = computed(() => (this.themeService.isDark() ? 'heroMoon' : 'heroSun'));
  readonly themeText = computed(() => (this.themeService.isDark() ? 'Dark' : 'Light'));

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Whether the configurator route (or a descendant of it) is currently active. */
  readonly isConfiguratorRoute = computed(
    () => this.currentUrl() === '/configure' || this.currentUrl().startsWith('/configure/'),
  );

  readonly navTarget = computed(() => (this.isConfiguratorRoute() ? '/' : '/configure'));
  readonly navLabel = computed(() =>
    this.isConfiguratorRoute() ? 'Back to dashboard' : 'Open configurator',
  );
  readonly navIcon = computed(() =>
    this.isConfiguratorRoute() ? 'heroArrowLeft' : 'heroCog6Tooth',
  );

  onToggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
