import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { SettingsService } from '../../../core/services/settings.service';
import { AppFooterComponent } from '../app-footer/app-footer.component';

const CONTAINER_BASE = 'overflow-anchor-none flex min-h-dvh w-full flex-col';
const CONTAINER_TEXT = 'text-neutral-800 dark:text-white';
/** Centred column; the footer bar follows the routed content. */
const HORIZONTAL_CONTAINER = `${CONTAINER_BASE} mx-auto max-w-[1360px] px-[clamp(16px,4vw,40px)] ${CONTAINER_TEXT}`;
/** Full width, 20 px padding (12 px below 1024 px); the rail carries what the footer bar would. */
const VERTICAL_CONTAINER = `${CONTAINER_BASE} p-5 max-[1024px]:p-3 ${CONTAINER_TEXT}`;

/**
 * Page container shared by every route. The window scrolls: routed content (which renders its own
 * header or rail) sits in a container whose width and padding depend on the active layout; the
 * horizontal layout also gets the footer bar in normal flow after it.
 */
@Component({
  selector: 'app-shell',
  imports: [AppFooterComponent],
  templateUrl: 'app-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly layout = inject(SettingsService).layout;

  protected readonly vertical = computed(() => this.layout() === 'vertical');
  protected readonly containerClass = computed(() =>
    this.vertical() ? VERTICAL_CONTAINER : HORIZONTAL_CONTAINER,
  );
}
