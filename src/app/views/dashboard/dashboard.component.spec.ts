import { render, screen } from '@testing-library/angular';
import { signal } from '@angular/core';

import { DashboardComponent } from './dashboard.component';

import { AppService } from '../../core/services/app.service';
import { SearchService } from '../../core/services/search.service';
import { SettingsService } from '../../core/services/settings.service';
import { ThemeService } from '../../core/services/theme.service';
import { MetadataService } from '../../core/services/metadata.service';
import { CategoryService } from '../../core/services/category.service';
import { IconService } from '../../core/services/icon.service';

import {
  APP_CATEGORY,
  DEFAULT_DASHBOARD_CONFIG,
  DashboardSettings,
  SelfhostedApp,
} from '../../core/models/dashboard.models';
import { expectNoAxeViolations } from '../../../testing/a11y';

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
    favorite: false,
  };

  const settingsState = signal<DashboardSettings>(DEFAULT_DASHBOARD_CONFIG.settings);
  const selectedCategory = signal(APP_CATEGORY.id);
  const haveSearch = signal(false);
  const currentTheme = signal<'light' | 'dark'>('dark');
  const isDark = signal(true);

  const appServiceMock = {
    appVersion: '0.2.0-test',
    filteredApps: signal<SelfhostedApp[] | undefined>([]),
    setSearchQuery: vi.fn(),
    setSelectedCategory: vi.fn(),
  };

  const iconServiceMock = {
    getIconUrl: vi.fn(() => 'https://example.com/icon.png'),
  };

  const expectBackgroundImageToBe = (expectedUrl: string) => {
    const escapedUrl = expectedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const bgLayer = document.getElementById('app-background');

    expect(bgLayer).not.toBeNull();
    expect(bgLayer!.style.backgroundImage).toMatch(
      new RegExp(`^url\\(["']?${escapedUrl}["']?\\)$`),
    );
    expect(bgLayer!.style.backgroundImage.match(/url\(/g)).toHaveLength(1);
  };

  const setup = async ({
    filteredApps = [] as SelfhostedApp[] | null,
    searchQuery = '',
    settings = DEFAULT_DASHBOARD_CONFIG.settings,
    isDarkMode = true,
  }: {
    filteredApps?: SelfhostedApp[] | null;
    searchQuery?: string;
    settings?: DashboardSettings;
    isDarkMode?: boolean;
  } = {}) => {
    let bgLayer = document.getElementById('app-background');
    if (!bgLayer) {
      bgLayer = document.createElement('div');
      bgLayer.id = 'app-background';
      document.body.appendChild(bgLayer);
    }
    bgLayer.style.backgroundImage = '';
    appServiceMock.setSearchQuery.mockReset();
    appServiceMock.setSelectedCategory.mockReset();
    iconServiceMock.getIconUrl.mockClear();
    settingsState.set(settings);
    haveSearch.set(false);
    selectedCategory.set(APP_CATEGORY.id);
    currentTheme.set(isDarkMode ? 'dark' : 'light');
    isDark.set(isDarkMode);
    appServiceMock.filteredApps = signal(filteredApps ?? undefined);

    return render(DashboardComponent, {
      providers: [
        {
          provide: AppService,
          useValue: appServiceMock,
        },
        {
          provide: SearchService,
          useValue: {
            searchQuery: signal(searchQuery),
            searchEngines: signal([]),
            haveSearch,
          },
        },
        {
          provide: SettingsService,
          useValue: {
            settings: settingsState,
          },
        },
        {
          provide: ThemeService,
          useValue: {
            currentTheme,
            isDark,
            isDarkMode: () => currentTheme() === 'dark',
            toggleTheme: vi.fn(),
          },
        },
        {
          provide: MetadataService,
          useValue: {
            metadata: signal(DEFAULT_DASHBOARD_CONFIG.metadata),
          },
        },
        {
          provide: CategoryService,
          useValue: {
            categories: signal([APP_CATEGORY]),
            selectedCategory,
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
    const view = await setup({
      filteredApps: null,
    });

    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Applications' })).not.toBeInTheDocument();
    expect(screen.queryByText('No applications found')).not.toBeInTheDocument();
  });

  it('should have no accessibility violations when applications are rendered', async () => {
    const secondAppFixture: SelfhostedApp = {
      ...appFixture,
      id: 'radarr',
      name: 'Radarr',
      url: 'https://radarr.example.com',
      favorite: false,
    };

    const view = await render(DashboardComponent, {
      providers: [
        {
          provide: AppService,
          useValue: {
            ...appServiceMock,
            filteredApps: signal([appFixture, secondAppFixture]),
          },
        },
        {
          provide: SearchService,
          useValue: {
            searchQuery: signal(''),
            searchEngines: signal([]),
            haveSearch,
          },
        },
        {
          provide: SettingsService,
          useValue: {
            settings: settingsState,
          },
        },
        {
          provide: ThemeService,
          useValue: {
            currentTheme,
            isDark,
            isDarkMode: () => currentTheme() === 'dark',
            toggleTheme: vi.fn(),
          },
        },
        {
          provide: MetadataService,
          useValue: {
            metadata: signal(DEFAULT_DASHBOARD_CONFIG.metadata),
          },
        },
        {
          provide: CategoryService,
          useValue: {
            categories: signal([APP_CATEGORY]),
            selectedCategory,
          },
        },
        {
          provide: IconService,
          useValue: iconServiceMock,
        },
      ],
    });

    await expectNoAxeViolations(view.container);
  });

  it('should have no accessibility violations in the loading state', async () => {
    const view = await render(DashboardComponent, {
      providers: [
        {
          provide: AppService,
          useValue: {
            ...appServiceMock,
            filteredApps: signal(undefined),
          },
        },
        {
          provide: SearchService,
          useValue: {
            searchQuery: signal(''),
            searchEngines: signal([]),
            haveSearch,
          },
        },
        {
          provide: SettingsService,
          useValue: {
            settings: settingsState,
          },
        },
        {
          provide: ThemeService,
          useValue: {
            currentTheme,
            isDark,
            isDarkMode: () => currentTheme() === 'dark',
            toggleTheme: vi.fn(),
          },
        },
        {
          provide: MetadataService,
          useValue: {
            metadata: signal(DEFAULT_DASHBOARD_CONFIG.metadata),
          },
        },
        {
          provide: CategoryService,
          useValue: {
            categories: signal([APP_CATEGORY]),
            selectedCategory,
          },
        },
        {
          provide: IconService,
          useValue: iconServiceMock,
        },
      ],
    });

    await expectNoAxeViolations(view.container);
  });

  it('should have no accessibility violations in the empty search state', async () => {
    const view = await setup({
      filteredApps: [],
      searchQuery: 'plex',
    });

    await expectNoAxeViolations(document.body);
  });

  it('should have no accessibility violations in the empty default state', async () => {
    await setup({
      filteredApps: [],
      searchQuery: '',
    });

    await expectNoAxeViolations(document.body);
  });

  it('should render the applications grid when apps are available', async () => {
    const secondAppFixture: SelfhostedApp = {
      ...appFixture,
      id: 'radarr',
      name: 'Radarr',
      url: 'https://radarr.example.com',
      favorite: false,
    };

    await setup({
      filteredApps: [appFixture, secondAppFixture],
      settings: {
        ...DEFAULT_DASHBOARD_CONFIG.settings,
        itemsPerRow: 5,
      },
    });

    const grid = screen.getByRole('list', { name: 'Applications' });

    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass('grid', 'xl:grid-cols-5');
    expect(screen.getAllByRole('button', { name: /^Open / })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Open Plex' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Radarr' })).toBeInTheDocument();
    expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument();
    expect(screen.queryByText('No applications found')).not.toBeInTheDocument();
  });

  it('should render the empty state for an active search', async () => {
    await setup({
      filteredApps: [],
      searchQuery: 'plex',
    });

    expect(screen.getByText('No applications found')).toBeInTheDocument();
    expect(
      screen.getByText('Try adjusting your search query or select a different category.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Applications' })).not.toBeInTheDocument();
    expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument();
  });

  it('should render the empty state without a search query', async () => {
    await setup({
      filteredApps: [],
      searchQuery: '',
    });

    expect(screen.getByText('No applications found')).toBeInTheDocument();
    expect(
      screen.getByText('Add some applications to your dashboard.yaml configuration.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Applications' })).not.toBeInTheDocument();
    expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument();
  });

  it('should apply the background image that matches the current theme', async () => {
    await setup({
      filteredApps: [appFixture],
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
      filteredApps: [appFixture],
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
      filteredApps: [appFixture],
      settings: {
        ...DEFAULT_DASHBOARD_CONFIG.settings,
        darkBackgroundImage: 'https://cdn.example.com/dark.jpg',
        lightBackgroundImage: 'http://cdn.example.com/light.jpg',
      },
      isDarkMode: true,
    });

    expectBackgroundImageToBe('https://cdn.example.com/dark.jpg');
    expect(document.getElementById('app-background')!.style.backgroundImage).not.toContain(
      '/img/https://cdn.example.com/dark.jpg',
    );
  });

  it('should not prefix http background image URLs with /img/', async () => {
    await setup({
      filteredApps: [appFixture],
      settings: {
        ...DEFAULT_DASHBOARD_CONFIG.settings,
        darkBackgroundImage: 'https://cdn.example.com/dark.jpg',
        lightBackgroundImage: 'http://cdn.example.com/light.jpg',
      },
      isDarkMode: false,
    });

    expectBackgroundImageToBe('http://cdn.example.com/light.jpg');
    expect(document.getElementById('app-background')!.style.backgroundImage).not.toContain(
      '/img/http://cdn.example.com/light.jpg',
    );
  });

  it('should update the background image when the theme changes after render', async () => {
    const view = await setup({
      filteredApps: [appFixture],
      settings: {
        ...DEFAULT_DASHBOARD_CONFIG.settings,
        darkBackgroundImage: 'custom-dark.jpg',
        lightBackgroundImage: 'custom-light.jpg',
      },
      isDarkMode: true,
    });

    expectBackgroundImageToBe('/img/custom-dark.jpg');

    currentTheme.set('light');
    await view.fixture.whenStable();

    expectBackgroundImageToBe('/img/custom-light.jpg');
  });

  it('should update the background image when settings change after render', async () => {
    const view = await setup({
      filteredApps: [appFixture],
      settings: {
        ...DEFAULT_DASHBOARD_CONFIG.settings,
        darkBackgroundImage: 'initial-dark.jpg',
        lightBackgroundImage: 'initial-light.jpg',
      },
      isDarkMode: true,
    });

    expectBackgroundImageToBe('/img/initial-dark.jpg');

    settingsState.set({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      darkBackgroundImage: 'updated-dark.jpg',
      lightBackgroundImage: 'updated-light.jpg',
    });
    await view.fixture.whenStable();

    expectBackgroundImageToBe('/img/updated-dark.jpg');
  });
});
