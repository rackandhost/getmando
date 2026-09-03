import { Routes } from '@angular/router';

import { DashboardComponent } from './views/dashboard/dashboard.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: DashboardComponent,
  },
  {
    path: 'configure',
    loadChildren: () =>
      import('./features/configurator/configurator.routes').then(
        (module) => module.CONFIGURATOR_ROUTES,
      ),
  },
];
