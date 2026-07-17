import { ChangeDetectionStrategy, Component } from '@angular/core';

import { DashboardComponent } from './views/dashboard/dashboard.component';
import { AppToastComponent } from './shared/components/app-toast/app-toast.component';

@Component({
  selector: 'app-root',
  imports: [DashboardComponent, AppToastComponent],
  templateUrl: 'app.html',
  styleUrl: 'app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
