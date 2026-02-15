import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { DASHBOARD_INITIALIZER_PROVIDER } from './core/initializers/dashboard.initializer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    DASHBOARD_INITIALIZER_PROVIDER
  ]
};
