import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DashboardConfig, DEFAULT_DASHBOARD_CONFIG } from '../models/dashboard.models';

import { ConfigService } from './config.service';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  it('uses default settings before config loads and reacts to configured settings', () => {
    const config = signal<DashboardConfig | undefined>(undefined);
    TestBed.configureTestingModule({
      providers: [{ provide: ConfigService, useValue: { config } }],
    });
    const service = TestBed.inject(SettingsService);

    expect(service.settings()).toBe(DEFAULT_DASHBOARD_CONFIG.settings);

    const settings = { ...DEFAULT_DASHBOARD_CONFIG.settings, theme: 'light' as const };
    config.set({ ...DEFAULT_DASHBOARD_CONFIG, settings });

    expect(service.settings()).toBe(settings);
  });
});
