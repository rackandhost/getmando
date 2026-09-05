import { render, screen, waitFor } from '@testing-library/angular';
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render app content using the configured icon and metadata', async () => {
    await setup();

    expect(iconServiceMock.getIconUrl).toHaveBeenCalledWith(appFixture);
    expect(screen.getByRole('button', { name: 'Open Plex' })).toBeInTheDocument();
    expect(screen.getByText('Plex')).toBeInTheDocument();
    expect(screen.getByText('Media server')).toBeInTheDocument();
    expect(screen.getByText('video')).toBeInTheDocument();
    expect(screen.getByText('streaming')).toBeInTheDocument();
    expect(screen.getByAltText('Plex icon')).toHaveAttribute(
      'src',
      'https://example.com/icons/plex.png',
    );
  });

  it('should have no accessibility violations', async () => {
    const view = await setup();

    await expectNoAxeViolations(view.container);
  });

  it('should render a green badge for a monitored app that is up', async () => {
    const view = await setup(
      { ...appFixture, healthCheck: true },
      DEFAULT_DASHBOARD_CONFIG.settings,
      { plex: { status: 'up', checkedAt: '2026-01-01T00:00:00.000Z' } },
    );

    const badge = screen.getByRole('img', { name: 'Plex is up' });
    expect(badge.className).toContain('bg-emerald-500');
    await expectNoAxeViolations(view.container);
  });

  it('should render a red badge for a monitored app that is down', async () => {
    await setup({ ...appFixture, healthCheck: true }, DEFAULT_DASHBOARD_CONFIG.settings, {
      plex: { status: 'down', checkedAt: '2026-01-01T00:00:00.000Z' },
    });

    const badge = screen.getByRole('img', { name: 'Plex is down' });
    expect(badge.className).toContain('bg-red-500');
  });

  it('should render no badge when healthCheck is disabled', async () => {
    await setup(appFixture, DEFAULT_DASHBOARD_CONFIG.settings, {
      plex: { status: 'up', checkedAt: '2026-01-01T00:00:00.000Z' },
    });

    expect(screen.queryByRole('img', { name: /Plex is (up|down)/ })).not.toBeInTheDocument();
  });

  it('should render no badge while the app has not been checked yet', async () => {
    await setup({ ...appFixture, healthCheck: true }, DEFAULT_DASHBOARD_CONFIG.settings, {
      other: { status: 'up', checkedAt: '2026-01-01T00:00:00.000Z' },
    });

    expect(screen.queryByRole('img', { name: /Plex is (up|down)/ })).not.toBeInTheDocument();
  });

  it('should render the badge once a status arrives after render', async () => {
    await setup({ ...appFixture, healthCheck: true });

    expect(screen.queryByRole('img', { name: /Plex is (up|down)/ })).not.toBeInTheDocument();

    statusesState.set({ plex: { status: 'up', checkedAt: '2026-01-01T00:00:00.000Z' } });

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Plex is up' })).toBeInTheDocument();
    });
  });

  it('should not render the description when showDescriptions is disabled', async () => {
    await setup(appFixture, {
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      showDescriptions: false,
    });

    expect(screen.queryByText('Media server')).not.toBeInTheDocument();
  });

  it('should not render tags when showLabels is disabled', async () => {
    await setup(appFixture, {
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      showLabels: false,
    });

    expect(screen.queryByText('video')).not.toBeInTheDocument();
    expect(screen.queryByText('streaming')).not.toBeInTheDocument();
  });

  it('should update description and tag visibility when settings change after render', async () => {
    await setup();

    expect(screen.getByText('Media server')).toBeInTheDocument();
    expect(screen.getByText('video')).toBeInTheDocument();

    settingsState.set({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      showDescriptions: false,
      showLabels: false,
    });

    await waitFor(() => {
      expect(screen.queryByText('Media server')).not.toBeInTheDocument();
      expect(screen.queryByText('video')).not.toBeInTheDocument();
      expect(screen.queryByText('streaming')).not.toBeInTheDocument();
    });
  });

  it('should open the app in a new tab and emit appClick on click', async () => {
    const user = userEvent.setup();
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const view = await setup();
    const appClickSpy = vi.fn();

    view.fixture.componentInstance.appClick.subscribe(appClickSpy);

    await user.click(screen.getByRole('button', { name: 'Open Plex' }));

    expect(windowOpenSpy).toHaveBeenCalledWith('https://plex.example.com', '_blank');
    expect(appClickSpy).toHaveBeenCalledWith(appFixture);
  });

  it('should open the app in the current tab when openNewTab is disabled', async () => {
    const user = userEvent.setup();
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await setup({
      ...appFixture,
      openNewTab: false,
    });

    await user.click(screen.getByRole('button', { name: 'Open Plex' }));

    expect(windowOpenSpy).toHaveBeenCalledWith('https://plex.example.com', '_self');
  });

  it('should support keyboard activation', async () => {
    const user = userEvent.setup();
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const view = await setup();
    const appClickSpy = vi.fn();

    view.fixture.componentInstance.appClick.subscribe(appClickSpy);

    const appCard = screen.getByRole('button', { name: 'Open Plex' });
    appCard.focus();

    await user.keyboard('{Enter}');

    expect(windowOpenSpy).toHaveBeenCalledWith('https://plex.example.com', '_blank');
    expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    expect(appClickSpy).toHaveBeenCalledWith(appFixture);
    expect(appClickSpy).toHaveBeenCalledTimes(1);
  });

  it('should support keyboard activation with Space', async () => {
    const user = userEvent.setup();
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const view = await setup();
    const appClickSpy = vi.fn();

    view.fixture.componentInstance.appClick.subscribe(appClickSpy);

    const appCard = screen.getByRole('button', { name: 'Open Plex' });
    appCard.focus();

    await user.keyboard(' ');

    expect(windowOpenSpy).toHaveBeenCalledWith('https://plex.example.com', '_blank');
    expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    expect(appClickSpy).toHaveBeenCalledWith(appFixture);
    expect(appClickSpy).toHaveBeenCalledTimes(1);
  });
});
