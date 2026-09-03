import { Routes } from '@angular/router';

import { ConfiguratorPageComponent } from './configurator-page.component';
import { ConfiguratorStore } from './configurator.store';

export { ConfiguratorPageComponent as ConfiguratorRouteComponent } from './configurator-page.component';

export const CONFIGURATOR_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    providers: [ConfiguratorStore],
    loadComponent: () => Promise.resolve(ConfiguratorPageComponent),
  },
];
