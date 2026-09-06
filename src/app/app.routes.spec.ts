import { Route, Routes } from '@angular/router';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TestBed } from '@angular/core/testing';

import { routes } from './app.routes';
import { ConfiguratorRouteComponent } from './features/configurator/configurator.routes';
import { DashboardComponent } from './views/dashboard/dashboard.component';

describe('application routes', () => {
  function configureRoute(): Route {
    const route = routes.find(({ path }) => path === 'configure');

    if (!route) throw new Error('The /configure route is not configured.');

    return route;
  }

  it('exposes a lazy configurator boundary for direct /configure navigation', async () => {
    const route = configureRoute();

    expect(route.loadChildren).toBeTypeOf('function');

    const childRoutes = await route.loadChildren!();
    const configuredRoutes = childRoutes as Routes;

    expect(configuredRoutes).toEqual([
      expect.objectContaining({ path: '', pathMatch: 'full', loadComponent: expect.any(Function) }),
    ]);

    const component = await configuredRoutes[0].loadComponent!();
    expect(component).toBe(ConfiguratorRouteComponent);
  });

  it('navigates directly to the configurator without rendering the dashboard route', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/configure', ConfiguratorRouteComponent);

    expect(harness.routeNativeElement?.textContent).toContain('Configuration editor');
    expect(harness.routeNativeElement?.querySelector('app-dashboard')).toBeNull();
  });

  it('keeps the dashboard as the eager root route', () => {
    expect(routes).toContainEqual(
      expect.objectContaining({ path: '', pathMatch: 'full', component: DashboardComponent }),
    );
  });

  it('does not redirect direct configurator navigation through the dashboard route', () => {
    const route = configureRoute();

    expect(route.redirectTo).toBeUndefined();
    expect(route.component).toBeUndefined();
  });
});
