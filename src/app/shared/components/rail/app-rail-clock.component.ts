import { NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';

import { SettingsService } from '../../../core/services/settings.service';
import { clockParts } from '../app-clock/clock-format';

/**
 * The rail's clock tile: `HH:mm` with the weekday and date pills above or below it, wrapping. In the
 * compact rail it becomes a single centred pill with smaller digits. Same content rules as the
 * horizontal clock (`showDate`, `datePosition`, `dateFormat`, `showSeconds`), but a different box, so
 * it is its own component; the colon never pulses.
 */
@Component({
  selector: 'app-rail-clock',
  imports: [NgTemplateOutlet, UpperCasePipe],
  templateUrl: 'app-rail-clock.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class AppRailClockComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly locale = inject(LOCALE_ID);

  private readonly now = signal(Date.now());

  protected readonly parts = computed(() =>
    clockParts(this.now(), this.settingsService.settings().dateFormat, this.locale),
  );

  protected readonly showDate = computed(() => this.settingsService.settings().showDate);
  protected readonly dateOnTop = computed(
    () => this.showDate() && this.settingsService.settings().datePosition === 'top',
  );
  protected readonly dateOnBottom = computed(
    () => this.showDate() && this.settingsService.settings().datePosition === 'bottom',
  );
  protected readonly showSeconds = computed(() => this.settingsService.settings().showSeconds);

  /** One name for the whole tile; it changes once a minute and is not announced. */
  protected readonly label = computed(() => {
    const { hours, minutes, weekday, date } = this.parts();
    const time = `${hours}:${minutes}`;
    return this.showDate() ? `${time}, ${weekday}, ${date}` : time;
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
