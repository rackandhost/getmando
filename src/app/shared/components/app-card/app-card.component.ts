import { Component, inject, input, output, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SelfhostedApp } from '../../../core/models/dashboard.models';

import { IconService } from '../../../core/services/icon.service';
import { AppService } from '../../../core/services/app.service';

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
  private readonly appService = inject(AppService);

  // Inputs
  readonly app = input.required<SelfhostedApp>();

  // Outputs
  readonly appClick = output<SelfhostedApp>();

  private readonly iconService = inject(IconService);

  /**
   * Get icon URL as computed signal
   */
  readonly iconUrl = computed(() => this.iconService.getIconUrl(this.app()));

  get showDescriptions(): boolean {
    return this.appService.settingsSubject.value.showDescriptions;
  }

  get showLabels(): boolean {
    return this.appService.settingsSubject.value.showLabels;
  }

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
