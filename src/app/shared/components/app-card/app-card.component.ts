import { Component, inject, input, output, ChangeDetectionStrategy, computed } from '@angular/core';

import { SelfhostedApp } from '../../../core/models/dashboard.models';

import { AppStatusService } from '../../../core/services/app-status.service';
import { IconService } from '../../../core/services/icon.service';
import { SettingsService } from '../../../core/services/settings.service';

let nextCardId = 0;

@Component({
  selector: 'app-card',
  standalone: true,
  templateUrl: 'app-card.component.html',
  host: {
    class: 'block h-full',
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

  private readonly id = nextCardId++;
  protected readonly descriptionId = `app-card-${this.id}-description`;
  protected readonly tagsId = `app-card-${this.id}-tags`;

  /**
   * Get icon URL as computed signal
   */
  readonly iconUrl = computed(() => this.iconService.getIconUrl(this.app()));

  readonly showDescriptions = computed(() => this.settings().showDescriptions);
  readonly showLabels = computed(() => this.settings().showLabels);
  protected readonly showTags = computed(() => this.showLabels() && this.app().tags.length > 0);

  /**
   * Status pill for monitored apps — undefined while healthCheck is off or no check has run yet.
   */
  readonly status = computed(() =>
    this.app().healthCheck ? this.appStatusService.statuses()[this.app().id] : undefined,
  );

  /**
   * Accessible name of the link. The pill is decorative (`aria-hidden`), so the up/down state is folded
   * into the name: `<name>, online` / `<name>, offline`. It always contains the link's visible text (the
   * name). Unmonitored apps keep the plain content name, so no label is set for them.
   */
  protected readonly linkLabel = computed(() => {
    const status = this.status();
    if (!status) return null;
    return `${this.app().name}, ${status.status === 'up' ? 'online' : 'offline'}`;
  });

  /** The description and the tag list, whichever are shown, are the link's accessible description. */
  protected readonly describedBy = computed(() => {
    const ids = [
      this.showDescriptions() ? this.descriptionId : null,
      this.showTags() ? this.tagsId : null,
    ].filter((id): id is string => id !== null);

    return ids.length > 0 ? ids.join(' ') : null;
  });

  /** The browser follows the link itself (new tab, middle click and so on); this only reports it. */
  protected onLinkClick(): void {
    this.appClick.emit(this.app());
  }
}
