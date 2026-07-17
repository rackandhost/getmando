import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DashboardConfig, DEFAULT_DASHBOARD_CONFIG } from '../models/dashboard.models';

import { ConfigService } from './config.service';
import { MetadataService } from './metadata.service';

describe('MetadataService', () => {
  it('projects metadata and reacts when config becomes available', () => {
    const config = signal<DashboardConfig | undefined>(undefined);
    TestBed.configureTestingModule({
      providers: [{ provide: ConfigService, useValue: { config } }],
    });
    const service = TestBed.inject(MetadataService);

    expect(service.metadata()).toBeUndefined();

    const metadata = { title: 'Home', description: 'Services' };
    config.set({ ...DEFAULT_DASHBOARD_CONFIG, metadata });

    expect(service.metadata()).toBe(metadata);
  });
});
