import { ChangeDetectionStrategy, Component } from '@angular/core';

import { DashboardHorizontalComponent } from './horizontal/dashboard-horizontal.component';

/** The dashboard route component; it picks the page layout the dashboard is drawn with. */
@Component({
  selector: 'app-dashboard',
  imports: [DashboardHorizontalComponent],
  template: '<app-dashboard-horizontal />',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class DashboardComponent {}
