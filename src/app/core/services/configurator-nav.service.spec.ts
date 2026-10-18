import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ConfiguratorNavService } from './configurator-nav.service';

describe('ConfiguratorNavService', () => {
  const setup = () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'configure', children: [{ path: 'x', children: [] }] },
        ]),
      ],
    });

    return { service: TestBed.inject(ConfiguratorNavService), router: TestBed.inject(Router) };
  };

  it('offers the configurator while on the dashboard', () => {
    const { service } = setup();

    expect(service.isConfiguratorRoute()).toBe(false);
    expect(service.target()).toBe('/configure');
    expect(service.label()).toBe('Open configurator');
    expect(service.icon()).toBe('heroCog6Tooth');
  });

  it.each(['/configure', '/configure/x'])('offers the way back while on %s', async (url) => {
    const { service, router } = setup();

    await router.navigateByUrl(url);

    expect(service.isConfiguratorRoute()).toBe(true);
    expect(service.target()).toBe('/');
    expect(service.label()).toBe('Back to dashboard');
    expect(service.icon()).toBe('heroArrowLeft');
  });

  it('follows the route when it changes in either direction', async () => {
    const { service, router } = setup();

    await router.navigateByUrl('/configure');
    expect(service.isConfiguratorRoute()).toBe(true);

    await router.navigateByUrl('/');
    expect(service.isConfiguratorRoute()).toBe(false);
    expect(service.target()).toBe('/configure');
  });

  it('does not mistake a route that only starts with the same letters for the configurator', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'configure-more', children: [] }])],
    });
    const service = TestBed.inject(ConfiguratorNavService);

    await TestBed.inject(Router).navigateByUrl('/configure-more');

    expect(service.isConfiguratorRoute()).toBe(false);
  });
});
