import {CommonModule, NgTemplateOutlet} from '@angular/common';
import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';

import {SettingsService} from '../../../core/services/settings.service';

@Component({
  selector: 'app-clock',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet],
  templateUrl: 'app-clock.component.html',
})
export class AppClockComponent implements OnInit, OnDestroy {
  private readonly settingsService = inject(SettingsService);

  private intervalId: ReturnType<typeof setInterval> | null = null;

  currentDate = signal<number>(Date.now());

  get dateFormat(): string {
    return this.settingsService.settingsSubject.value.dateFormat;
  }

  get dateOnBottom(): boolean {
    return this.showDate && this.settingsService.settingsSubject.value.datePosition === 'bottom';
  }

  get dateOnTop(): boolean {
    return this.showDate && this.settingsService.settingsSubject.value.datePosition === 'top';
  }

  get showSeconds(): boolean {
    return this.settingsService.settingsSubject.value.showSeconds;
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
    return this.settingsService.settingsSubject.value.showDate;
  }
}
