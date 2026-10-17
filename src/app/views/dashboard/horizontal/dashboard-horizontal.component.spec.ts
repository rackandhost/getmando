import { render, screen, within } from '@testing-library/angular';
import { computed, signal, type WritableSignal } from '@angular/core';

import { DashboardHorizontalComponent } from './dashboard-horizontal.component';

import { AppService } from '../../../core/services/app.service';
import { SearchService } from '../../../core/services/search.service';
import { SettingsService } from '../../../core/services/settings.service';
import { ThemeService } from '../../../core/services/theme.service';
import { MetadataService } from '../../../core/services/metadata.service';
import { CategoryService } from '../../../core/services/category.service';
import { IconService } from '../../../core/services/icon.service';
import { ScrollStateService, type ChromeProbe } from '../../../core/scroll/scroll-state.service';
import { AppShellComponent } from '../../../shared/components/app-shell/app-shell.component';
import type { ChromeMode } from '../../../core/scroll/scroll-state';

import {
  APP_CATEGORY,
  DEFAULT_DASHBOARD_CONFIG,
  DashboardSettings,
  SelfhostedApp,
} from '../../../core/models/dashboard.models';
import { expectNoAxeViolations } from '../../../../testing/a11y';

describe('DashboardHorizontalComponent', () => {
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
    healthCheck: false,
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

  const setup = async ({
    filteredApps = [] as SelfhostedApp[] | null,
    searchQuery = '',
    settings = DEFAULT_DASHBOARD_CONFIG.settings,
    isDarkMode = true,
    scrollState,
    withShell = false,
  }: {
    filteredApps?: SelfhostedApp[] | null;
    searchQuery?: string;
    settings?: DashboardSettings;
    isDarkMode?: boolean;
    scrollState?: Pick<ScrollStateService, 'register'>;
    /** Renders the page inside `app-shell`, which owns the footer. */
    withShell?: boolean;
  } = {}) => {
    appServiceMock.setSearchQuery.mockReset();
    appServiceMock.setSelectedCategory.mockReset();
    iconServiceMock.getIconUrl.mockClear();
    settingsState.set(settings);
    haveSearch.set(false);
    selectedCategory.set(APP_CATEGORY.id);
    currentTheme.set(isDarkMode ? 'dark' : 'light');
    isDark.set(isDarkMode);
    appServiceMock.filteredApps = signal(filteredApps ?? undefined);

    const providers = [
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
          layout: computed(() => settingsState().layout),
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
      ...(scrollState ? [{ provide: ScrollStateService, useValue: scrollState }] : []),
    ];

    return withShell
      ? render('<app-shell><app-dashboard-horizontal /></app-shell>', {
          imports: [AppShellComponent, DashboardHorizontalComponent],
          providers,
        })
      : render(DashboardHorizontalComponent, { providers });
  };

  it('should render the loading state while applications are still pending', async () => {
    const view = await setup({
      filteredApps: null,
    });

    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Applications' })).not.toBeInTheDocument();
    expect(screen.queryByText('No applications found')).not.toBeInTheDocument();
  });

  it('renders the page header itself, ahead of the main landmark', async () => {
    await setup({ filteredApps: [appFixture] });

    const banner = screen.getByRole('banner');
    const main = screen.getByRole('main');

    expect(banner).toHaveTextContent(DEFAULT_DASHBOARD_CONFIG.metadata.title);
    expect(banner.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main).not.toContainElement(banner);
    expect(screen.getByRole('link', { name: 'Open configurator' })).toBeInTheDocument();
  });

  it('should have no accessibility violations when applications are rendered', async () => {
    const secondAppFixture: SelfhostedApp = {
      ...appFixture,
      id: 'radarr',
      name: 'Radarr',
      url: 'https://radarr.example.com',
      favorite: false,
      healthCheck: false,
    };

    const view = await render(DashboardHorizontalComponent, {
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
    const view = await render(DashboardHorizontalComponent, {
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

  it('keeps the keyboard path in visual order from the header to the footer', async () => {
    await setup({ filteredApps: [appFixture], withShell: true });

    const path = [
      screen.getByRole('link', { name: 'Open configurator' }),
      screen.getByRole('button', { name: 'Toggle theme' }),
      screen.getByRole('button', { name: /^Select search engine/ }),
      screen.getByRole('searchbox', { name: 'Search applications' }),
      screen.getByRole('button', { name: 'Apps' }),
      screen.getByRole('link', { name: /Plex/ }),
      screen.getByRole('link', { name: 'Mando' }),
      screen.getByRole('link', { name: 'Rack&Host' }),
    ];

    path.forEach((control, index) => {
      if (index > 0) {
        expect(
          path[index - 1].compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING,
          `${control.textContent?.trim() || control.getAttribute('aria-label')} follows its predecessor`,
        ).toBeTruthy();
      }
    });
    expect(
      document.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])'),
    ).toHaveLength(0);
  });

  it('should render the applications grid when apps are available', async () => {
    const secondAppFixture: SelfhostedApp = {
      ...appFixture,
      id: 'radarr',
      name: 'Radarr',
      url: 'https://radarr.example.com',
      favorite: false,
      healthCheck: false,
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
    expect(within(grid).getAllByRole('link')).toHaveLength(2);
    expect(within(grid).getByRole('link', { name: 'Plex' })).toBeInTheDocument();
    expect(within(grid).getByRole('link', { name: 'Radarr' })).toBeInTheDocument();
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

  describe('empty state', () => {
    const emoji = /\p{Extended_Pictographic}/u;

    it('shows a titled card with a decorative magnifier-minus icon and no emoji', async () => {
      await setup({ filteredApps: [], searchQuery: 'plex' });

      const title = screen.getByRole('heading', { level: 2, name: 'No applications found' });
      const card = title.closest('section');

      expect(card).not.toBeNull();
      expect(card?.querySelector('[name="heroMagnifyingGlassMinus"]')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
      expect(card?.textContent).not.toMatch(emoji);
    });

    it('keeps the category tabs disabled while a search has no results', async () => {
      const view = await setup({ filteredApps: [], searchQuery: 'plex' });
      haveSearch.set(true);
      await view.fixture.whenStable();

      const tabs = within(screen.getByRole('navigation', { name: 'Categories' })).getAllByRole(
        'button',
      );

      expect(tabs.length).toBeGreaterThan(0);
      tabs.forEach((tab) => expect(tab).toBeDisabled());
    });
  });

  describe('loading state', () => {
    it('keeps its copy and shows a decorative line icon instead of an emoji', async () => {
      await setup({ filteredApps: null });

      const title = screen.getByRole('heading', { level: 2, name: 'Loading dashboard...' });
      const card = title.closest('section');

      expect(screen.getByText('Please wait while we load your applications')).toBeInTheDocument();
      expect(card?.querySelector('[name="heroArrowPath"]')).toHaveAttribute('aria-hidden', 'true');
      expect(card?.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    });
  });

  describe('dock', () => {
    // One scroll-state mode per registered chrome, so the desktop and the mobile dock can differ.
    const modes: Record<string, WritableSignal<ChromeMode>> = {};
    const dispose = vi.fn();
    const probes: Record<string, ChromeProbe> = {};
    const scrollState = {
      register: vi.fn((registered: ChromeProbe) => {
        probes[registered.id] = registered;
        modes[registered.id] ??= signal<ChromeMode>('static');
        return { mode: modes[registered.id].asReadonly(), dispose };
      }),
    };
    const mode = {
      set: (next: ChromeMode) => modes['dashboard-dock'].set(next),
    };
    const probe = (id = 'dashboard-dock') => probes[id] as ChromeProbe | undefined;

    const stubMatchMedia = (matches: boolean) => {
      const value = vi.fn((query: string) => ({
        matches,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value });
    };

    const renderDock = (settings = DEFAULT_DASHBOARD_CONFIG.settings) =>
      setup({ filteredApps: [appFixture], settings, scrollState });

    const dock = () => document.querySelector<HTMLElement>('[data-dock]') as HTMLElement;

    const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

    beforeEach(() => {
      Object.keys(modes).forEach((id) => delete modes[id]);
      Object.keys(probes).forEach((id) => delete probes[id]);
      scrollState.register.mockClear();
      dispose.mockClear();
      // The desktop layout is the default of the component; tests that need the phone layout stub it again.
      stubMatchMedia(true);
    });

    afterEach(() => {
      // test-setup.ts installs one matchMedia for the whole run: put it back, never delete it, so the
      // specs that run after this file do not find the API missing.
      if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
      document.documentElement.style.removeProperty('--dock-compact-height');
    });

    it('wraps the header, clock, search and tabs in one dock and leaves the grid outside', async () => {
      await renderDock();

      const stickyDock = dock();

      expect(within(stickyDock).getByRole('banner')).toBeInTheDocument();
      expect(within(stickyDock).getByRole('img', { name: /^\d\d:\d\d/ })).toBeInTheDocument();
      expect(
        within(stickyDock).getByRole('searchbox', { name: 'Search applications' }),
      ).toBeInTheDocument();
      expect(
        within(stickyDock).getByRole('navigation', { name: 'Categories' }),
      ).toBeInTheDocument();
      expect(
        within(stickyDock).queryByRole('list', { name: 'Applications' }),
      ).not.toBeInTheDocument();
      expect(stickyDock).not.toContainElement(screen.getByRole('main'));
      expect(screen.getByRole('main')).toContainElement(
        screen.getByRole('list', { name: 'Applications' }),
      );
    });

    it('keeps the banner outside main and the dock content in a labelled region', async () => {
      await renderDock();

      expect(screen.getByRole('main')).not.toContainElement(screen.getByRole('banner'));
      expect(
        within(screen.getByRole('region', { name: 'Dashboard controls' })).getByRole('searchbox'),
      ).toBeInTheDocument();
    });

    it('follows the scroll state through data-dock', async () => {
      const view = await renderDock();

      expect(dock()).toHaveAttribute('data-dock', 'static');

      for (const next of ['top', 'scrolled', 'static'] as const) {
        mode.set(next);
        await view.fixture.whenStable();
        expect(dock()).toHaveAttribute('data-dock', next);
      }
    });

    it.each([
      ['static', 'false'],
      ['top', 'false'],
      ['scrolled', 'true'],
    ] as const)(
      'makes header, clock and search compact only when scrolled (%s)',
      async (state, expected) => {
        const view = await renderDock();
        mode.set(state);
        await view.fixture.whenStable();

        const compacts = Array.from(dock().querySelectorAll('[data-compact]'));

        expect(compacts).toHaveLength(3);
        compacts.forEach((element) => expect(element).toHaveAttribute('data-compact', expected));
      },
    );

    it('keeps the seconds readout in the compact clock', async () => {
      const view = await renderDock({ ...DEFAULT_DASHBOARD_CONFIG.settings, showSeconds: true });
      mode.set('scrolled');
      await view.fixture.whenStable();

      expect(
        within(dock())
          .getByRole('img', { name: /^\d\d:\d\d/ })
          .querySelector('[aria-hidden="true"]'),
      ).not.toBeNull();
    });

    it('registers the desktop and the mobile dock and disposes both on destroy', async () => {
      const view = await renderDock();

      expect(scrollState.register).toHaveBeenCalledTimes(2);
      expect(probe()?.minViewportHeight).toBe(720);
      expect(probe('dashboard-mobile-dock')).toBeDefined();

      view.fixture.destroy();

      expect(dispose).toHaveBeenCalledTimes(2);
    });

    it('measures the compaction delta as the Top height minus the compact-height token', async () => {
      await renderDock();
      vi.spyOn(dock(), 'getBoundingClientRect').mockReturnValue({ height: 584 } as DOMRect);
      document.documentElement.style.setProperty('--dock-compact-height', '278px');

      expect(probe()?.compactDelta()).toBe(306);

      document.documentElement.style.setProperty('--dock-compact-height', '300px');

      expect(probe()?.compactDelta()).toBe(284);
    });

    it('keeps the last Top height while scrolled, so flipping never changes the delta', async () => {
      const view = await renderDock();
      const rect = vi
        .spyOn(dock(), 'getBoundingClientRect')
        .mockReturnValue({ height: 584 } as DOMRect);
      document.documentElement.style.setProperty('--dock-compact-height', '278px');
      expect(probe()?.compactDelta()).toBe(306);

      mode.set('scrolled');
      await view.fixture.whenStable();
      rect.mockReturnValue({ height: 278 } as DOMRect);

      expect(probe()?.compactDelta()).toBe(306);
    });

    it('never reports a negative delta', async () => {
      await renderDock();
      vi.spyOn(dock(), 'getBoundingClientRect').mockReturnValue({ height: 100 } as DOMRect);
      document.documentElement.style.setProperty('--dock-compact-height', '278px');

      expect(probe()?.compactDelta()).toBe(0);
    });

    it('keeps the desktop dock Static at 600 px wide or less (the mobile dock takes over)', async () => {
      stubMatchMedia(false);
      await renderDock();

      expect(probe()?.minViewportHeight).toBe(Number.POSITIVE_INFINITY);
    });

    it('keeps the 720 px height guard above 600 px wide', async () => {
      stubMatchMedia(true);
      await renderDock();

      expect(probe()?.minViewportHeight).toBe(720);
    });

    describe('mobile dock', () => {
      const mobileDock = () =>
        document.querySelectorAll<HTMLElement>('[data-dock]')[1] as HTMLElement;

      it('wraps only the search bar and the tabs, with the banner and the clock outside', async () => {
        await renderDock();

        const inner = within(mobileDock());

        expect(inner.getByRole('searchbox', { name: 'Search applications' })).toBeInTheDocument();
        expect(inner.getByRole('navigation', { name: 'Categories' })).toBeInTheDocument();
        expect(inner.queryByRole('banner')).not.toBeInTheDocument();
        expect(inner.queryByRole('img', { name: /^\d\d:\d\d/ })).not.toBeInTheDocument();
        expect(dock()).toContainElement(mobileDock());
      });

      it('is only active up to 600 px wide, from 500 px of viewport height, with Δ = 16', async () => {
        stubMatchMedia(false);
        await renderDock();

        expect(probe('dashboard-mobile-dock')?.minViewportHeight).toBe(500);
        expect(probe('dashboard-mobile-dock')?.compactDelta()).toBe(16);
      });

      it('stays Static above 600 px wide, where the desktop dock is the sticky one', async () => {
        stubMatchMedia(true);
        await renderDock();

        expect(probe('dashboard-mobile-dock')?.minViewportHeight).toBe(Number.POSITIVE_INFINITY);
      });

      it('follows its own scroll state through data-dock', async () => {
        const view = await renderDock();

        for (const next of ['top', 'scrolled', 'static'] as const) {
          modes['dashboard-mobile-dock'].set(next);
          await view.fixture.whenStable();
          expect(mobileDock()).toHaveAttribute('data-dock', next);
        }
        expect(dock()).toHaveAttribute('data-dock', 'static');
      });

      it('compacts the search bar but never the header or the clock', async () => {
        const view = await renderDock();
        modes['dashboard-mobile-dock'].set('scrolled');
        await view.fixture.whenStable();

        const inner = Array.from(mobileDock().querySelectorAll('[data-compact]'));
        const outer = Array.from(dock().querySelectorAll('[data-compact]')).filter(
          (element) => !inner.includes(element),
        );

        expect(inner).toHaveLength(1);
        inner.forEach((element) => expect(element).toHaveAttribute('data-compact', 'true'));
        expect(outer).toHaveLength(2);
        outer.forEach((element) => expect(element).toHaveAttribute('data-compact', 'false'));
      });
    });

    describe('accessibility', () => {
      it.each([
        ['Static', 'dashboard-dock', 'static'],
        ['Top', 'dashboard-dock', 'top'],
        ['Scrolled (desktop dock)', 'dashboard-dock', 'scrolled'],
        ['Scrolled (mobile dock)', 'dashboard-mobile-dock', 'scrolled'],
      ] as const)('has no axe violations with the dock %s', async (_label, chrome, state) => {
        const view = await renderDock({ ...DEFAULT_DASHBOARD_CONFIG.settings, showSeconds: true });
        modes[chrome].set(state);
        await view.fixture.whenStable();

        await expectNoAxeViolations(document.body);
      });
    });
  });
});
