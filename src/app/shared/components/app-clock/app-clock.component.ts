import { NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';

import { SettingsService } from '../../../core/services/settings.service';

import { clockParts } from './clock-format';

@Component({
  selector: 'app-clock',
  imports: [NgTemplateOutlet, UpperCasePipe],
  templateUrl: 'app-clock.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppClockComponent implements OnInit, OnDestroy {
  private readonly settingsService = inject(SettingsService);
  private readonly locale = inject(LOCALE_ID);

  private intervalId: ReturnType<typeof setInterval> | undefined;

  /** One row of 40 px digits with the pills inline, shown while the dock is scrolled. */
  readonly compact = input(false);

  currentDate = signal<number>(Date.now());

  protected readonly parts = computed(() =>
    clockParts(this.currentDate(), this.settingsService.settings().dateFormat, this.locale),
  );

  /** One name for the whole widget; it changes once a minute and is not announced. */
  protected readonly label = computed(() => {
    const { hours, minutes, weekday, date } = this.parts();
    const time = `${hours}:${minutes}`;
    return this.showDate ? `${time}, ${weekday}, ${date}` : time;
  });

  get dateOnBottom(): boolean {
    return this.showDate && this.settingsService.settings().datePosition === 'bottom';
  }

  get dateOnTop(): boolean {
    return this.showDate && this.settingsService.settings().datePosition === 'top';
  }

  get showSeconds(): boolean {
    return this.settingsService.settings().showSeconds;
  }

  ngOnInit(): void {
    this.intervalId = setInterval(() => {
      this.currentDate.set(Date.now());
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
  }

  private get showDate(): boolean {
    return this.settingsService.settings().showDate;
  }
}
