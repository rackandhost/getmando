import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DashboardConfig, DEFAULT_DASHBOARD_CONFIG } from '../models/dashboard.models';

import { BookmarkService } from './bookmark.service';
import { ConfigService } from './config.service';

describe('BookmarkService', () => {
  it('projects bookmarks from config and reacts to config changes', () => {
    const config = signal<DashboardConfig | undefined>(undefined);
    TestBed.configureTestingModule({
      providers: [{ provide: ConfigService, useValue: { config } }],
    });
    const service = TestBed.inject(BookmarkService);

    expect(service.bookmarks()).toEqual([]);

    const bookmark = {
      id: 'docs',
      name: 'Docs',
      description: 'Reference',
      url: 'https://docs.example.com',
      icon: { type: 'name' as const, value: 'docs' },
      openNewTab: true,
      tags: ['reference'],
    };
    config.set({ ...DEFAULT_DASHBOARD_CONFIG, bookmarks: [bookmark] });

    expect(service.bookmarks()).toEqual([bookmark]);
  });
});
