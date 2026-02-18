import { Component } from '@angular/core';

import { DashboardComponent } from './views/dashboard/dashboard.component';

@Component({
  selector: 'app-root',
  imports: [DashboardComponent],
  templateUrl: 'app.html',
  styleUrl: 'app.css',
})
export class App {}
