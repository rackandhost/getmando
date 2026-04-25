import {TestBed} from '@angular/core/testing';
import {BehaviorSubject, firstValueFrom} from 'rxjs';

import {AppService} from './app.service';
import {ConfigService} from './config.service';
import {BookmarkService} from './bookmark.service';
import {SearchService} from './search.service';
import {CategoryService} from './category.service';
import {YamlLoaderService} from './yaml-loader.service';

import {
  APP_CATEGORY,
  BOOKMARKS_CATEGORY,
  FAVORITES_CATEGORY,
  DashboardConfig,
  DEFAULT_DASHBOARD_CONFIG,
  SelfhostedApp,
} from '../models/dashboard.models';

describe('AppService', () => {
  let service: AppService;
  let configSubject: BehaviorSubject<DashboardConfig>;
  let searchService: SearchService;
  let categoryService: CategoryService;

  const createConfig = (overrides: Partial<DashboardConfig> = {}): DashboardConfig => ({
    ...DEFAULT_DASHBOARD_CONFIG,
    ...overrides,
  });

  beforeEach(() => {
    configSubject = new BehaviorSubject<DashboardConfig>(createConfig());

    TestBed.configureTestingModule({
      providers: [
        AppService,
        SearchService,
        CategoryService,
        {
          provide: ConfigService,
          useValue: {
            config$: configSubject.asObservable(),
            subject: configSubject,
            fireNewSubject: (config: DashboardConfig) => configSubject.next(config),
          },
        },
        {
          provide: YamlLoaderService,
          useValue: {
            loadDashboardConfig: () => new BehaviorSubject(createConfig()),
          },
        },
        {
          provide: BookmarkService,
          useValue: {
            bookmarks: [],
          },
        },
      ],
    });

    service = TestBed.inject(AppService);
    searchService = TestBed.inject(SearchService);
    categoryService = TestBed.inject(CategoryService);
  });

  describe('apps$', () => {
    it('should assign favorite: false to bookmarks when allowBookmarks is true', async () => {
      const bookmarkServiceMock = TestBed.inject(BookmarkService);
      (bookmarkServiceMock as unknown as {bookmarks: unknown[]}).bookmarks = [
        {
          id: 'google',
          name: 'Google',
          description: 'Search engine',
          url: 'https://google.com',
          icon: {type: 'name', value: 'google'},
          openNewTab: true,
          tags: [],
        },
      ];

      configSubject.next(
        createConfig({
          applications: [],
          bookmarks: [
            {
              id: 'google',
              name: 'Google',
              description: 'Search engine',
              url: 'https://google.com',
              icon: {type: 'name', value: 'google'},
              openNewTab: true,
              tags: [],
            },
          ],
          settings: {
            ...DEFAULT_DASHBOARD_CONFIG.settings,
            allowBookmarks: true,
          },
        }),
      );

      const apps = await firstValueFrom(service.apps$);
      expect(apps).toHaveLength(1);
      expect(apps[0].favorite).toBe(false);
      expect(apps[0].category).toBe(BOOKMARKS_CATEGORY.id);
    });
  });

  describe('getAppsByCategory', () => {
    it('should return only favorite apps when categoryId is FAVORITES_CATEGORY.id', () => {
      configSubject.next(
        createConfig({
          applications: [
            {
              id: 'plex',
              name: 'Plex',
              description: '',
              url: 'https://plex.example.com',
              icon: {type: 'name', value: 'plex'},
              category: 'media',
              openNewTab: true,
              tags: [],
              favorite: true,
            },
            {
              id: 'radarr',
              name: 'Radarr',
              description: '',
              url: 'https://radarr.example.com',
              icon: {type: 'name', value: 'radarr'},
              category: 'media',
              openNewTab: true,
              tags: [],
              favorite: false,
            },
          ],
        }),
      );

      const apps = service.getAppsByCategory(FAVORITES_CATEGORY.id);
      expect(apps).toHaveLength(1);
      expect(apps[0].id).toBe('plex');
    });

    it('should return all apps for APP_CATEGORY regardless of favorite status', () => {
      configSubject.next(
        createConfig({
          applications: [
            {
              id: 'plex',
              name: 'Plex',
              description: '',
              url: 'https://plex.example.com',
              icon: {type: 'name', value: 'plex'},
              category: 'media',
              openNewTab: true,
              tags: [],
              favorite: true,
            },
            {
              id: 'radarr',
              name: 'Radarr',
              description: '',
              url: 'https://radarr.example.com',
              icon: {type: 'name', value: 'radarr'},
              category: 'media',
              openNewTab: true,
              tags: [],
              favorite: false,
            },
          ],
        }),
      );

      const apps = service.getAppsByCategory(APP_CATEGORY.id);
      expect(apps).toHaveLength(2);
    });
  });
});
