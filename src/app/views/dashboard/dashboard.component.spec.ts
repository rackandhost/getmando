import {render, screen} from '@testing-library/angular';
import {BehaviorSubject, Observable, Subject, of} from 'rxjs';

import {DashboardComponent} from './dashboard.component';

import {AppService} from '../../core/services/app.service';
import {SearchService} from '../../core/services/search.service';
import {SettingsService} from '../../core/services/settings.service';
import {ThemeService} from '../../core/services/theme.service';
import {MetadataService} from '../../core/services/metadata.service';
import {CategoryService} from '../../core/services/category.service';
import {IconService} from '../../core/services/icon.service';

import {APP_CATEGORY, DEFAULT_DASHBOARD_CONFIG, DashboardSettings, SelfhostedApp} from '../../core/models/dashboard.models';

describe('DashboardComponent', () => {
  const appFixture: SelfhostedApp = {
    id: 'plex',
    name: 'Plex',
    description: 'Media server',
    url: 'https://plex.example.com',
    icon: {
      type: 'name',
      value: 'plex',
    },
    category: 'media',
    openNewTab: true,
    tags: ['video'],
  };

  const settingsSubject = new BehaviorSubject<DashboardSettings>(DEFAULT_DASHBOARD_CONFIG.settings);
  const selectedCategorySubject = new BehaviorSubject<string>(APP_CATEGORY.id);
  const haveSearchSubject = new BehaviorSubject<boolean>(false);
  const themeSubject = new BehaviorSubject<'light' | 'dark' | 'auto'>('dark');

  const appServiceMock = {
    appVersion: '0.2.0-test',
    filteredApps$: of([] as SelfhostedApp[]),
    setSearchQuery: vi.fn(),
    setSelectedCategory: vi.fn(),
  };

  const iconServiceMock = {
    getIconUrl: vi.fn(() => 'https://example.com/icon.png'),
  };

  const expectBackgroundImageToBe = (expectedUrl: string) => {
    const escapedUrl = expectedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    expect(document.body.style.backgroundImage).toMatch(new RegExp(`^url\\(["']?${escapedUrl}["']?\\)$`));
    expect(document.body.style.backgroundImage.match(/url\(/g)).toHaveLength(1);
  };

  const setup = async ({
    filteredApps$ = of([] as SelfhostedApp[]),
    searchQuery$ = of(''),
    settings = DEFAULT_DASHBOARD_CONFIG.settings,
    isDarkMode = true,
  }: {
    filteredApps$?: Observable<SelfhostedApp[]>;
    searchQuery$?: Observable<string>;
    settings?: DashboardSettings;
    isDarkMode?: boolean;
  } = {}): Promise<void> => {
    document.body.style.backgroundImage = '';
    appServiceMock.setSearchQuery.mockReset();
    appServiceMock.setSelectedCategory.mockReset();
    iconServiceMock.getIconUrl.mockClear();
    settingsSubject.next(settings);
    haveSearchSubject.next(false);
    selectedCategorySubject.next(APP_CATEGORY.id);
    themeSubject.next(isDarkMode ? 'dark' : 'light');
    appServiceMock.filteredApps$ = filteredApps$;

    await render(DashboardComponent, {
      providers: [
        {
          provide: AppService,
          useValue: appServiceMock,
        },
        {
          provide: SearchService,
          useValue: {
            searchQuery$,
            searchEngines$: of([]),
            haveSearchSubject,
          },
        },
        {
          provide: SettingsService,
          useValue: {
            settings$: settingsSubject.asObservable(),
            settingsSubject,
          },
        },
        {
          provide: ThemeService,
          useValue: {
            themeSubject,
            isDarkMode: () => themeSubject.value === 'dark',
            toggleTheme: vi.fn(),
          },
        },
        {
          provide: MetadataService,
          useValue: {
            metadata$: of(DEFAULT_DASHBOARD_CONFIG.metadata),
          },
        },
        {
          provide: CategoryService,
          useValue: {
            categories$: of([APP_CATEGORY]),
            selectedCategory$: selectedCategorySubject,
          },
        },
        {
          provide: IconService,
          useValue: iconServiceMock,
        },
      ],
    });
  };

  it('should render the loading state while applications are still pending', async () => {
    const filteredAppsSubject = new Subject<SelfhostedApp[]>();

    await setup({
      filteredApps$: filteredAppsSubject.asObservable(),
    });

    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
    expect(screen.queryByRole('list', {name: 'Applications'})).not.toBeInTheDocument();
    expect(screen.queryByText('No applications found')).not.toBeInTheDocument();
  });

  it('should render the applications grid when apps are available', async () => {
    const secondAppFixture: SelfhostedApp = {
      ...appFixture,
      id: 'radarr',
      name: 'Radarr',
      url: 'https://radarr.example.com',
    };

    await setup({
      filteredApps$: of([appFixture, secondAppFixture]),
      settings: {
        ...DEFAULT_DASHBOARD_CONFIG.settings,
        itemsPerRow: 5,
      },
    });

    const grid = screen.getByRole('list', {name: 'Applications'});

    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass('grid', 'xl:grid-cols-5');
    expect(screen.getAllByRole('button', {name: /^Open /})).toHaveLength(2);
    expect(screen.getByRole('button', {name: 'Open Plex'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Radarr'})).toBeInTheDocument();
    expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument();
    expect(screen.queryByText('No applications found')).not.toBeInTheDocument();
  });

  it('should render the empty state for an active search', async () => {
    await setup({
      filteredApps$: of([]),
      searchQuery$: of('plex'),
    });

    expect(screen.getByText('No applications found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search query or select a different category.')).toBeInTheDocument();
    expect(screen.queryByRole('list', {name: 'Applications'})).not.toBeInTheDocument();
    expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument();
  });

  it('should render the empty state without a search query', async () => {
    await setup({
      filteredApps$: of([]),
      searchQuery$: of(''),
    });

    expect(screen.getByText('No applications found')).toBeInTheDocument();
    expect(screen.getByText('Add some applications to your dashboard.yaml configuration.')).toBeInTheDocument();
    expect(screen.queryByRole('list', {name: 'Applications'})).not.toBeInTheDocument();
    expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument();
  });

  it('should apply the background image that matches the current theme', async () => {
    await setup({
      filteredApps$: of([appFixture]),
      settings: {
        ...DEFAULT_DASHBOARD_CONFIG.settings,
        darkBackgroundImage: 'custom-dark.jpg',
        lightBackgroundImage: 'custom-light.jpg',
      },
      isDarkMode: true,
    });

    expectBackgroundImageToBe('/img/custom-dark.jpg');
  });

  it('should apply the light background image when light theme is active', async () => {
    await setup({
      filteredApps$: of([appFixture]),
      settings: {
        ...DEFAULT_DASHBOARD_CONFIG.settings,
        darkBackgroundImage: 'custom-dark.jpg',
        lightBackgroundImage: 'custom-light.jpg',
      },
      isDarkMode: false,
    });

    expectBackgroundImageToBe('/img/custom-light.jpg');
  });

  it('should not prefix https background image URLs with /img/', async () => {
    await setup({
      filteredApps$: of([appFixture]),
      settings: {
        ...DEFAULT_DASHBOARD_CONFIG.settings,
        darkBackgroundImage: 'https://cdn.example.com/dark.jpg',
        lightBackgroundImage: 'http://cdn.example.com/light.jpg',
      },
      isDarkMode: true,
    });

    expectBackgroundImageToBe('https://cdn.example.com/dark.jpg');
    expect(document.body.style.backgroundImage).not.toContain('/img/https://cdn.example.com/dark.jpg');
  });

  it('should not prefix http background image URLs with /img/', async () => {
    await setup({
      filteredApps$: of([appFixture]),
      settings: {
        ...DEFAULT_DASHBOARD_CONFIG.settings,
        darkBackgroundImage: 'https://cdn.example.com/dark.jpg',
        lightBackgroundImage: 'http://cdn.example.com/light.jpg',
      },
      isDarkMode: false,
    });

    expectBackgroundImageToBe('http://cdn.example.com/light.jpg');
    expect(document.body.style.backgroundImage).not.toContain('/img/http://cdn.example.com/light.jpg');
  });

  it('should update the background image when the theme changes after render', async () => {
    await setup({
      filteredApps$: of([appFixture]),
      settings: {
        ...DEFAULT_DASHBOARD_CONFIG.settings,
        darkBackgroundImage: 'custom-dark.jpg',
        lightBackgroundImage: 'custom-light.jpg',
      },
      isDarkMode: true,
    });

    expectBackgroundImageToBe('/img/custom-dark.jpg');

    themeSubject.next('light');

    expectBackgroundImageToBe('/img/custom-light.jpg');
  });

  it('should update the background image when settings change after render', async () => {
    await setup({
      filteredApps$: of([appFixture]),
      settings: {
        ...DEFAULT_DASHBOARD_CONFIG.settings,
        darkBackgroundImage: 'initial-dark.jpg',
        lightBackgroundImage: 'initial-light.jpg',
      },
      isDarkMode: true,
    });

    expectBackgroundImageToBe('/img/initial-dark.jpg');

    settingsSubject.next({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      darkBackgroundImage: 'updated-dark.jpg',
      lightBackgroundImage: 'updated-light.jpg',
    });

    expectBackgroundImageToBe('/img/updated-dark.jpg');
  });
});
