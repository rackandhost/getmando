import { Component, inject, input, output, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SelfhostedApp } from '../../../core/models/dashboard.models';

import { AppStatusService } from '../../../core/services/app-status.service';
import { IconService } from '../../../core/services/icon.service';
import { SettingsService } from '../../../core/services/settings.service';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'app-card.component.html',
  host: {
    class: 'block',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppCardComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly settings = this.settingsService.settings;
  private readonly appStatusService = inject(AppStatusService);

  // Inputs
  readonly app = input.required<SelfhostedApp>();

  // Outputs
  readonly appClick = output<SelfhostedApp>();

  private readonly iconService = inject(IconService);

  /**
   * Get icon URL as computed signal
   */
  readonly iconUrl = computed(() => this.iconService.getIconUrl(this.app()));

  readonly showDescriptions = computed(() => this.settings().showDescriptions);
  readonly showLabels = computed(() => this.settings().showLabels);

  /**
   * Status badge for monitored apps — undefined while healthCheck is off or no check has run yet.
   */
  readonly status = computed(() =>
    this.app().healthCheck ? this.appStatusService.statuses()[this.app().id] : undefined,
  );

  /**
   * Open application
   */
  openApp(): void {
    const app = this.app();
    const target = app.openNewTab ? '_blank' : '_self';

    window.open(app.url, target);
    this.appClick.emit(app);
  }
}
