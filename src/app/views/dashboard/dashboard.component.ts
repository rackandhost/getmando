import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { SettingsService } from '../../core/services/settings.service';

import { DashboardHorizontalComponent } from './horizontal/dashboard-horizontal.component';
import { DashboardVerticalComponent } from './vertical/dashboard-vertical.component';

/** The dashboard route component; it draws the dashboard with the layout the configuration selects. */
@Component({
  selector: 'app-dashboard',
  imports: [DashboardHorizontalComponent, DashboardVerticalComponent],
  template: `@switch (layout()) {
    @case ('vertical') {
      <app-dashboard-vertical />
    }
    @default {
      <app-dashboard-horizontal />
    }
  }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class DashboardComponent {
  protected readonly layout = inject(SettingsService).layout;
}
