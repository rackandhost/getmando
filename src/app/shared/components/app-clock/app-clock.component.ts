import { CommonModule, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';

import { SettingsService } from '../../../core/services/settings.service';

@Component({
  selector: 'app-clock',
  imports: [CommonModule, NgTemplateOutlet],
  templateUrl: 'app-clock.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppClockComponent implements OnInit, OnDestroy {
  private readonly settingsService = inject(SettingsService);

  private intervalId: ReturnType<typeof setInterval> | null = null;

  currentDate = signal<number>(Date.now());

  get dateFormat(): string {
    return this.settingsService.settings().dateFormat;
  }

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
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private get showDate(): boolean {
    return this.settingsService.settings().showDate;
  }
}
