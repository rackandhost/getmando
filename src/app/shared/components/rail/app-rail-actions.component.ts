import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowLeft, heroCog6Tooth } from '@ng-icons/heroicons/outline';

import { AppService } from '../../../core/services/app.service';
import { ConfiguratorNavService } from '../../../core/services/configurator-nav.service';
import { ThemePickerComponent } from '../theme-picker/theme-picker.component';

export type RailActionsMode = 'wide' | 'compact';

/** Pinned to the bottom of the wide rail, below a rule; hidden when the rail turns into a bar. */
const WIDE_HOST =
  'mt-auto flex flex-col gap-3 border-t border-line pt-3.5 font-mono text-[11px] leading-[15px] text-muted max-[1024px]:hidden';
/** Sits in the first row of the compact rail, after the brand; hidden when the rail is a column. */
const COMPACT_HOST = 'flex shrink-0 items-center gap-2 min-[1024px]:hidden';
/** The action buttons are square with an icon only; the way back in the wide rail also reads "Dashboard". */
const ICON_BUTTON =
  'glass-chrome flex size-11 items-center justify-center rounded-xl text-text transition-transform active:scale-95';
const BACK_BUTTON_WITH_TEXT =
  'glass-chrome flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-text transition-transform active:scale-95';

/**
 * The configurator link and the theme picker of the rail, with the version and the credit in the wide
 * position. The rail renders it twice, in the two places the actions occupy (the bottom of the wide
 * rail, the first row of the compact one), so the DOM order is the visual order at every width; the
 * position that is not shown is `display: none`, out of the focus order and the accessibility tree.
 */
@Component({
  selector: 'app-rail-actions',
  imports: [NgIcon, NgTemplateOutlet, RouterLink, ThemePickerComponent],
  templateUrl: 'app-rail-actions.component.html',
  viewProviders: [provideIcons({ heroArrowLeft, heroCog6Tooth })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'hostClass()' },
})
export class AppRailActionsComponent {
  protected readonly nav = inject(ConfiguratorNavService);

  readonly mode = input.required<RailActionsMode>();

  protected readonly appVersion = inject(AppService).appVersion;
  protected readonly year = new Date().getFullYear();

  protected readonly hostClass = computed(() =>
    this.mode() === 'wide' ? WIDE_HOST : COMPACT_HOST,
  );
  /** The text only appears beside the arrow of the way back, and only where the rail is a column. */
  protected readonly showsBackText = computed(
    () => this.mode() === 'wide' && this.nav.isConfiguratorRoute(),
  );
  protected readonly linkClass = computed(() =>
    this.showsBackText() ? BACK_BUTTON_WITH_TEXT : ICON_BUTTON,
  );
}
