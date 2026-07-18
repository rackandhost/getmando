import { TestBed } from '@angular/core/testing';

import { DEFAULT_DASHBOARD_CONFIG } from '../models/dashboard.models';

import { ConfigService } from './config.service';

describe('ConfigService', () => {
  it('publishes undefined until a config is provided and reacts to updates', () => {
    const service = TestBed.inject(ConfigService);

    expect(service.config()).toBeUndefined();

    const config = { ...DEFAULT_DASHBOARD_CONFIG };
    service.fireNewSubject(config);

    expect(service.config()).toBe(config);
  });
});
