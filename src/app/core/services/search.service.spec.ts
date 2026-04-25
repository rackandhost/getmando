import {TestBed} from '@angular/core/testing';
import {BehaviorSubject} from 'rxjs';

import {SearchService} from './search.service';
import {ConfigService} from './config.service';

import {
  APP_CATEGORY,
  BOOKMARKS_CATEGORY,
  FAVORITES_CATEGORY,
  SelfhostedApp,
} from '../models/dashboard.models';

describe('SearchService', () => {
  let service: SearchService;

  const createApp = (overrides: Partial<SelfhostedApp> = {}): SelfhostedApp => ({
    id: 'test',
    name: 'Test App',
    description: 'A test app',
    url: 'https://test.example.com',
    icon: {type: 'name', value: 'test'},
    category: 'media',
    openNewTab: true,
    tags: [],
    favorite: false,
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SearchService,
        {
          provide: ConfigService,
          useValue: {
            config$: new BehaviorSubject({}),
          },
        },
      ],
    });

    service = TestBed.inject(SearchService);
  });

  describe('filterApps', () => {
    it('should return only favorited apps when categoryId is FAVORITES_CATEGORY.id', () => {
      const apps: SelfhostedApp[] = [
        createApp({id: 'plex', name: 'Plex', favorite: true}),
        createApp({id: 'radarr', name: 'Radarr', favorite: false}),
        createApp({id: 'sonarr', name: 'Sonarr', favorite: true}),
      ];

      const result = service.filterApps(apps, '', FAVORITES_CATEGORY.id, false);

      expect(result).toHaveLength(2);
      expect(result.map((a) => a.id)).toEqual(['plex', 'sonarr']);
    });

    it('should return empty array when no favorites exist and FAVORITES_CATEGORY is selected', () => {
      const apps: SelfhostedApp[] = [
        createApp({id: 'radarr', name: 'Radarr', favorite: false}),
        createApp({id: 'sonarr', name: 'Sonarr', favorite: false}),
      ];

      const result = service.filterApps(apps, '', FAVORITES_CATEGORY.id, false);

      expect(result).toHaveLength(0);
    });

    it('should bypass category filter when searchAll is true, returning matching apps regardless of favorite status', () => {
      const apps: SelfhostedApp[] = [
        createApp({id: 'plex', name: 'Plex Media', favorite: true}),
        createApp({id: 'radarr', name: 'Radarr', favorite: false}),
      ];

      const result = service.filterApps(apps, 'Plex', FAVORITES_CATEGORY.id, true);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('plex');
    });

    it('should still include favorited apps in their original category', () => {
      const apps: SelfhostedApp[] = [
        createApp({id: 'plex', name: 'Plex', category: 'media', favorite: true}),
        createApp({id: 'radarr', name: 'Radarr', category: 'media', favorite: false}),
      ];

      const result = service.filterApps(apps, '', 'media', false);

      expect(result).toHaveLength(2);
    });

    it('should combine favorites filter with search text', () => {
      const apps: SelfhostedApp[] = [
        createApp({id: 'plex', name: 'Plex', favorite: true}),
        createApp({id: 'plex-2', name: 'Plex Two', favorite: true}),
        createApp({id: 'radarr', name: 'Radarr', favorite: false}),
      ];

      const result = service.filterApps(apps, 'Two', FAVORITES_CATEGORY.id, false);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('plex-2');
    });
  });
});
