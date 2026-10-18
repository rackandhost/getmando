import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';

import {
  APP_CATEGORY,
  DEFAULT_DASHBOARD_CONFIG,
  type Category,
  type DashboardSettings,
  type SelfhostedApp,
} from '../../../core/models/dashboard.models';
import { AppService } from '../../../core/services/app.service';
import { CategoryService } from '../../../core/services/category.service';
import { IconService } from '../../../core/services/icon.service';
import { MetadataService } from '../../../core/services/metadata.service';
import { SearchService } from '../../../core/services/search.service';
import { SettingsService } from '../../../core/services/settings.service';
import { ThemeService } from '../../../core/services/theme.service';
import { THEME_IDS, type ThemeId } from '../../../core/themes/theme.registry';
import { expectNoAxeViolations } from '../../../../testing/a11y';
import { themeServiceStub } from '../../../../testing/theme-service.stub';

import { DashboardVerticalComponent } from './dashboard-vertical.component';

describe('DashboardVerticalComponent', () => {
  const app = (id: string, name: string): SelfhostedApp => ({
    id,
    name,
    description: `${name} description`,
    url: `https://${id}.example.com`,
    icon: { type: 'name', value: id },
    category: 'media',
    openNewTab: true,
    tags: [],
    favorite: false,
    healthCheck: false,
  });
  const plex = app('plex', 'Plex');
  const radarr = app('radarr', 'Radarr');
  const sonarr = app('sonarr', 'Sonarr');

  const categories: Category[] = [APP_CATEGORY, { id: 'media', name: 'Media' }];

  const setup = async ({
    apps = [plex, radarr, sonarr] as SelfhostedApp[] | null,
    query = '',
    selected = 'media',
    settings = DEFAULT_DASHBOARD_CONFIG.settings,
    theme = 'dark',
  }: {
    apps?: SelfhostedApp[] | null;
    query?: string;
    selected?: string;
    settings?: DashboardSettings;
    theme?: ThemeId;
  } = {}) => {
    const settingsState = signal<DashboardSettings>({ ...settings, layout: 'vertical' });

    const view = await render(DashboardVerticalComponent, {
      providers: [
        provideRouter([]),
        {
          provide: AppService,
          useValue: {
            appVersion: '2.2.0',
            filteredApps: signal(apps ?? undefined),
            setSearchQuery: vi.fn(),
            setSelectedCategory: vi.fn(),
          },
        },
        {
          provide: SearchService,
          useValue: {
            searchQuery: signal(query),
            searchEngines: signal([]),
            haveSearch: signal(query.trim() !== ''),
          },
        },
        {
          provide: SettingsService,
          useValue: { settings: settingsState, layout: computed(() => settingsState().layout) },
        },
        { provide: ThemeService, useValue: themeServiceStub(theme) },
        {
          provide: MetadataService,
          useValue: { metadata: signal(DEFAULT_DASHBOARD_CONFIG.metadata) },
        },
        {
          provide: CategoryService,
          useValue: { categories: signal(categories), selectedCategory: signal(selected) },
        },
        {
          provide: IconService,
          useValue: { getIconUrl: vi.fn(() => 'https://example.com/i.png') },
        },
      ],
    });

    return { ...view, settingsState };
  };

  it('exposes an aside named Dashboard, a nav named Categories and one main', async () => {
    await setup();

    expect(screen.getByRole('complementary', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Categories' })).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('has the dashboard title in the rail as the only h1 and the category name in main as h2', async () => {
    await setup();

    const rail = screen.getByRole('complementary', { name: 'Dashboard' });

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(rail).getByRole('heading', { level: 1 })).toHaveTextContent(
      DEFAULT_DASHBOARD_CONFIG.metadata.title,
    );
    expect(
      within(screen.getByRole('main')).getByRole('heading', { level: 2, name: 'Media' }),
    ).toBeInTheDocument();
  });

  describe('heading row', () => {
    it('reads the category and the number of items', async () => {
      await setup();

      expect(screen.getByRole('heading', { level: 2, name: 'Media' })).toBeInTheDocument();
      expect(within(screen.getByRole('main')).getByText('3 items')).toBeInTheDocument();
    });

    it('reads Results and a singular count while a query is active', async () => {
      await setup({ apps: [plex], query: 'plex' });

      expect(screen.getByRole('heading', { level: 2, name: 'Results' })).toBeInTheDocument();
      expect(within(screen.getByRole('main')).getByText('1 item')).toBeInTheDocument();
    });

    it('shows no count while the applications are loading', async () => {
      await setup({ apps: null });

      expect(within(screen.getByRole('main')).queryByText(/\d+ items?/)).not.toBeInTheDocument();
    });
  });

  describe('grid', () => {
    it('lists the applications with their cards', async () => {
      await setup();

      const list = screen.getByRole('list', { name: 'Applications' });

      expect(within(list).getAllByRole('listitem')).toHaveLength(3);
      expect(within(list).getByRole('link', { name: /Plex/ })).toHaveAttribute(
        'href',
        'https://plex.example.com',
      );
    });

    it('ignores itemsPerRow: the same markup for 1 and for 10', async () => {
      const { settingsState, fixture } = await setup();
      const list = () => screen.getByRole('list', { name: 'Applications' });

      settingsState.update((current) => ({ ...current, itemsPerRow: 1 }));
      fixture.detectChanges();
      const one = list().className;

      settingsState.update((current) => ({ ...current, itemsPerRow: 10 }));
      fixture.detectChanges();

      expect(list().className).toBe(one);
    });
  });

  it('shows the loading state while the applications are pending', async () => {
    await setup({ apps: null });

    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Applications' })).not.toBeInTheDocument();
  });

  it('shows the empty state in the main column', async () => {
    await setup({ apps: [], query: 'zzz' });

    const main = screen.getByRole('main');

    expect(
      within(main).getByRole('heading', { name: 'No applications found' }),
    ).toBeInTheDocument();
    expect(within(main).getByText(/Try adjusting your search query/)).toBeInTheDocument();
  });

  it('draws the controls in DOM order: brand, compact actions, search, categories, wide actions, cards', async () => {
    const { container } = await setup();

    // The theme picker's dialog is closed: its own controls are not part of the page's order.
    const controls = Array.from(container.querySelectorAll<HTMLElement>('a[href], button, input'))
      .filter((element) => !element.closest('dialog'))
      .map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim());

    expect(controls).toEqual([
      // compact position of the actions, right after the brand
      'Open configurator',
      'Change theme, current: Dark',
      'Select search engine, Apps',
      'Search applications',
      'Apps',
      'Media',
      // wide position of the actions, after the categories
      'Mando v2.2.0',
      'Open configurator',
      'Change theme, current: Dark',
      'Rack&Host',
      // cards
      expect.stringContaining('Plex'),
      expect.stringContaining('Radarr'),
      expect.stringContaining('Sonarr'),
      // compact closing footer
      'Mando',
      'Rack&Host',
    ]);
  });

  it('closes the page with the footer content, which is not a landmark inside the grid', async () => {
    await setup();

    expect(screen.getByRole('contentinfo')).toHaveTextContent('Powered by Mando v2.2.0');
    expect(within(screen.getByRole('main')).queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it.each(THEME_IDS)('has no accessibility violations in the %s theme', async (theme) => {
    const { container } = await setup({ theme });

    await expectNoAxeViolations(container);
  });

  it.each([
    ['empty', { apps: [] as SelfhostedApp[], query: 'zzz' }],
    ['loading', { apps: null }],
  ])('has no accessibility violations when %s', async (_state, options) => {
    const { container } = await setup(options);

    await expectNoAxeViolations(container);
  });
});
