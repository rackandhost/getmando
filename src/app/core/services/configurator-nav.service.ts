import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

/**
 * The link between the dashboard and the configurator, shared by every layout's chrome: where it
 * points, how it reads and which icon it carries depending on the route that is active.
 */
@Injectable({ providedIn: 'root' })
export class ConfiguratorNavService {
  private readonly router = inject(Router);

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

  readonly target = computed(() => (this.isConfiguratorRoute() ? '/' : '/configure'));
  readonly label = computed(() =>
    this.isConfiguratorRoute() ? 'Back to dashboard' : 'Open configurator',
  );
  readonly icon = computed(() => (this.isConfiguratorRoute() ? 'heroArrowLeft' : 'heroCog6Tooth'));
}
