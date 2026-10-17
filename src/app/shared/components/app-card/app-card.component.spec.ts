import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal } from '@angular/core';

import { AppCardComponent } from './app-card.component';

import { IconService } from '../../../core/services/icon.service';
import { SettingsService } from '../../../core/services/settings.service';

import { AppStatusService, AppStatus } from '../../../core/services/app-status.service';

import { DEFAULT_DASHBOARD_CONFIG, SelfhostedApp } from '../../../core/models/dashboard.models';
import { expectNoAxeViolations } from '../../../../testing/a11y';

describe('AppCardComponent', () => {
  const settingsState = signal(DEFAULT_DASHBOARD_CONFIG.settings);
  const statusesState = signal<Record<string, AppStatus>>({});
  const iconServiceMock = {
    getIconUrl: vi.fn((app: SelfhostedApp) => `https://example.com/icons/${app.id}.png`),
  };

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
    tags: ['video', 'streaming'],
    favorite: false,
    healthCheck: false,
  };

  const monitored = { ...appFixture, healthCheck: true };
  const up: Record<string, AppStatus> = {
    plex: { status: 'up', checkedAt: '2026-01-01T00:00:00.000Z' },
  };
  const down: Record<string, AppStatus> = {
    plex: { status: 'down', checkedAt: '2026-01-01T00:00:00.000Z' },
  };

  const setup = async (
    app: SelfhostedApp = appFixture,
    settings = DEFAULT_DASHBOARD_CONFIG.settings,
    statuses: Record<string, AppStatus> = {},
  ) => {
    settingsState.set(settings);
    statusesState.set(statuses);
    iconServiceMock.getIconUrl.mockClear();

    const view = await render(AppCardComponent, {
      inputs: {
        app,
      },
      providers: [
        {
          provide: IconService,
          useValue: iconServiceMock,
        },
        {
          provide: SettingsService,
          useValue: {
            settings: settingsState,
          },
        },
        {
          provide: AppStatusService,
          useValue: {
            statuses: statusesState,
          },
        },
      ],
    });

    return view;
  };

  /** The status pill is the one `aria-hidden` element that carries `UP` or `DOWN`. */
  const pill = (container: HTMLElement): HTMLElement | null =>
    container.querySelector('[aria-hidden="true"][data-status]');

  /** jsdom cannot navigate; keep link activations from logging "not implemented". */
  const swallowNavigation = () => {
    const prevent = (event: Event) => event.preventDefault();
    document.addEventListener('click', prevent);
    return () => document.removeEventListener('click', prevent);
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('content', () => {
    it('shows the icon tile, name, description and tags with the configured icon', async () => {
      await setup();

      expect(iconServiceMock.getIconUrl).toHaveBeenCalledWith(appFixture);
      expect(screen.getByAltText('Plex icon')).toHaveAttribute(
        'src',
        'https://example.com/icons/plex.png',
      );
      expect(screen.getByRole('link', { name: 'Plex' })).toBeInTheDocument();
      expect(screen.getByText('Media server')).toBeInTheDocument();
      expect(screen.getByText('video')).toBeInTheDocument();
      expect(screen.getByText('streaming')).toBeInTheDocument();
    });

    it('keeps the icon, name, description and tags in that order', async () => {
      await setup();

      const order = [
        screen.getByAltText('Plex icon'),
        screen.getByRole('link', { name: 'Plex' }),
        screen.getByText('Media server'),
        screen.getByText('video'),
      ];

      order.slice(1).forEach((element, index) => {
        expect(
          order[index].compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      });
    });

    it('gives the generated initials icon an alt text', async () => {
      await setup({ ...appFixture, icon: { type: 'initials', value: 'PL' } });

      expect(screen.getByAltText('Plex icon')).toBeInTheDocument();
    });

    it('should not render the description when showDescriptions is disabled', async () => {
      await setup(appFixture, { ...DEFAULT_DASHBOARD_CONFIG.settings, showDescriptions: false });

      expect(screen.queryByText('Media server')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Plex' })).not.toHaveAccessibleDescription(
        /Media server/,
      );
    });

    it('should not render tags when showLabels is disabled', async () => {
      await setup(appFixture, { ...DEFAULT_DASHBOARD_CONFIG.settings, showLabels: false });

      expect(screen.queryByText('video')).not.toBeInTheDocument();
      expect(screen.queryByText('streaming')).not.toBeInTheDocument();
    });

    it('should not render a tag list for an app without tags', async () => {
      await setup({ ...appFixture, tags: [] });

      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('should update description and tag visibility when settings change after render', async () => {
      const view = await setup();

      expect(screen.getByText('Media server')).toBeInTheDocument();
      expect(screen.getByText('video')).toBeInTheDocument();

      settingsState.set({
        ...DEFAULT_DASHBOARD_CONFIG.settings,
        showDescriptions: false,
        showLabels: false,
      });
      await view.fixture.whenStable();

      expect(screen.queryByText('Media server')).not.toBeInTheDocument();
      expect(screen.queryByText('video')).not.toBeInTheDocument();
    });
  });

  describe('link', () => {
    it('holds only the app name and has a real href', async () => {
      await setup();

      const link = screen.getByRole('link', { name: 'Plex' });

      expect(link).toHaveTextContent(/^Plex$/);
      expect(link).toHaveAttribute('href', 'https://plex.example.com');
    });

    it('opens in a new tab safely when openNewTab is true', async () => {
      await setup();

      const link = screen.getByRole('link', { name: 'Plex' });

      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('stays in the current tab, with no target or rel, when openNewTab is false', async () => {
      await setup({ ...appFixture, openNewTab: false });

      const link = screen.getByRole('link', { name: 'Plex' });

      expect(link).not.toHaveAttribute('target');
      expect(link).not.toHaveAttribute('rel');
    });

    it('emits appClick once per activation, without opening anything itself', async () => {
      const user = userEvent.setup();
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const stop = swallowNavigation();
      const view = await setup();
      const appClickSpy = vi.fn();
      view.fixture.componentInstance.appClick.subscribe(appClickSpy);

      await user.click(screen.getByRole('link', { name: 'Plex' }));
      stop();

      expect(appClickSpy).toHaveBeenCalledExactlyOnceWith(appFixture);
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('is activated with Enter, emitting appClick once', async () => {
      const user = userEvent.setup();
      const stop = swallowNavigation();
      const view = await setup();
      const appClickSpy = vi.fn();
      view.fixture.componentInstance.appClick.subscribe(appClickSpy);

      screen.getByRole('link', { name: 'Plex' }).focus();
      await user.keyboard('{Enter}');
      stop();

      expect(appClickSpy).toHaveBeenCalledExactlyOnceWith(appFixture);
    });

    it('is the only tab stop of the card', async () => {
      const user = userEvent.setup();
      await setup();

      await user.tab();
      expect(screen.getByRole('link', { name: 'Plex' })).toHaveFocus();

      await user.tab();
      expect(document.body).toHaveFocus();
    });
  });

  describe('accessible name and description', () => {
    it.each([
      ['an unmonitored app', appFixture, {}, 'Plex'],
      ['a monitored app that is up', monitored, up, 'Plex, online'],
      ['a monitored app that is down', monitored, down, 'Plex, offline'],
      ['a monitored app without a result yet', monitored, {}, 'Plex'],
    ])('names the link for %s', async (_, app, statuses, name) => {
      await setup(app, DEFAULT_DASHBOARD_CONFIG.settings, statuses);

      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    });

    it('never uses the old "Open <name>, currently up|down" pattern', async () => {
      await setup(monitored, DEFAULT_DASHBOARD_CONFIG.settings, up);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Open /i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /currently/i })).not.toBeInTheDocument();
    });

    it.each([
      ['unmonitored', appFixture, {}],
      ['up', monitored, up],
      ['down', monitored, down],
    ])(
      'keeps the visible text in the accessible name (label in name) when %s',
      async (_, app, statuses) => {
        await setup(app, DEFAULT_DASHBOARD_CONFIG.settings, statuses);

        const link = screen.getByRole('link');

        expect(link.getAttribute('aria-label') ?? link.textContent).toContain(
          link.textContent?.trim() ?? '',
        );
      },
    );

    it('announces the description and the tags as the link description', async () => {
      await setup();

      expect(screen.getByRole('link', { name: 'Plex' })).toHaveAccessibleDescription(
        /Media server.*video.*streaming/s,
      );
    });

    it('describes the link by whichever of description and tags are shown', async () => {
      await setup(appFixture, { ...DEFAULT_DASHBOARD_CONFIG.settings, showLabels: false });

      const link = screen.getByRole('link', { name: 'Plex' });

      expect(link).toHaveAccessibleDescription('Media server');
    });

    it('should have no accessibility violations', async () => {
      const view = await setup();

      await expectNoAxeViolations(view.container);
    });

    it('should have no accessibility violations when monitored', async () => {
      const view = await setup(monitored, DEFAULT_DASHBOARD_CONFIG.settings, down);

      await expectNoAxeViolations(view.container);
    });
  });

  describe('status pill', () => {
    it('shows UP for a monitored app that is up, hidden from assistive technology', async () => {
      const view = await setup(monitored, DEFAULT_DASHBOARD_CONFIG.settings, up);

      const statusPill = pill(view.container);

      expect(statusPill).toHaveTextContent('UP');
      expect(statusPill).toHaveAttribute('aria-hidden', 'true');
      expect(statusPill?.dataset['status']).toBe('up');
    });

    it('shows DOWN for a monitored app that is down', async () => {
      const view = await setup(monitored, DEFAULT_DASHBOARD_CONFIG.settings, down);

      const statusPill = pill(view.container);

      expect(statusPill).toHaveTextContent('DOWN');
      expect(statusPill).toHaveAttribute('aria-hidden', 'true');
      expect(statusPill?.dataset['status']).toBe('down');
    });

    it('should render no pill when healthCheck is disabled, even with a stored result', async () => {
      const view = await setup(appFixture, DEFAULT_DASHBOARD_CONFIG.settings, up);

      expect(pill(view.container)).toBeNull();
    });

    it('should render no pill while the app has not been checked yet', async () => {
      const view = await setup(monitored, DEFAULT_DASHBOARD_CONFIG.settings, {});

      expect(pill(view.container)).toBeNull();
    });

    it('should render the pill, and rename the link, once a status arrives after render', async () => {
      const view = await setup(monitored, DEFAULT_DASHBOARD_CONFIG.settings, {});

      expect(pill(view.container)).toBeNull();

      statusesState.set(up);
      await view.fixture.whenStable();

      expect(pill(view.container)).toHaveTextContent('UP');
      expect(screen.getByRole('link', { name: 'Plex, online' })).toBeInTheDocument();
    });
  });
});
