import {render, screen} from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {BehaviorSubject} from 'rxjs';

import {AppCardComponent} from './app-card.component';

import {AppService} from '../../../core/services/app.service';
import {IconService} from '../../../core/services/icon.service';
import {SettingsService} from '../../../core/services/settings.service';

import {DEFAULT_DASHBOARD_CONFIG, SelfhostedApp} from '../../../core/models/dashboard.models';

describe('AppCardComponent', () => {
  const settingsSubject = new BehaviorSubject(DEFAULT_DASHBOARD_CONFIG.settings);
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
  };

  const setup = async (
    app: SelfhostedApp = appFixture,
    settings = DEFAULT_DASHBOARD_CONFIG.settings,
  ) => {
    settingsSubject.next(settings);
    iconServiceMock.getIconUrl.mockClear();

    const view = await render(AppCardComponent, {
      inputs: {
        app,
      },
      providers: [
        {
          provide: AppService,
          useValue: {},
        },
        {
          provide: IconService,
          useValue: iconServiceMock,
        },
        {
          provide: SettingsService,
          useValue: {
            settingsSubject,
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
    expect(screen.getByRole('button', {name: 'Open Plex'})).toBeInTheDocument();
    expect(screen.getByText('Plex')).toBeInTheDocument();
    expect(screen.getByText('Media server')).toBeInTheDocument();
    expect(screen.getByText('video')).toBeInTheDocument();
    expect(screen.getByText('streaming')).toBeInTheDocument();
    expect(screen.getByAltText('Plex icon')).toHaveAttribute('src', 'https://example.com/icons/plex.png');
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

  it('should open the app in a new tab and emit appClick on click', async () => {
    const user = userEvent.setup();
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const view = await setup();
    const appClickSpy = vi.fn();

    view.fixture.componentInstance.appClick.subscribe(appClickSpy);

    await user.click(screen.getByRole('button', {name: 'Open Plex'}));

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

    await user.click(screen.getByRole('button', {name: 'Open Plex'}));

    expect(windowOpenSpy).toHaveBeenCalledWith('https://plex.example.com', '_self');
  });

  it('should support keyboard activation', async () => {
    const user = userEvent.setup();
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const view = await setup();
    const appClickSpy = vi.fn();

    view.fixture.componentInstance.appClick.subscribe(appClickSpy);

    const appCard = screen.getByRole('button', {name: 'Open Plex'});
    appCard.focus();

    await user.keyboard('{Enter}');

    expect(windowOpenSpy).toHaveBeenCalledWith('https://plex.example.com', '_blank');
    expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    expect(appClickSpy).toHaveBeenCalledWith(appFixture);
    expect(appClickSpy).toHaveBeenCalledTimes(1);
  });

  it('should support keyboard activation with Space', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const view = await setup();
    const appClickSpy = vi.fn();

    view.fixture.componentInstance.appClick.subscribe(appClickSpy);

    const appCard = screen.getByRole('button', {name: 'Open Plex'});
    appCard.focus();

    appCard.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', code: 'Space', bubbles: true, cancelable: true}));
    appCard.dispatchEvent(new KeyboardEvent('keyup', {key: ' ', code: 'Space', bubbles: true}));

    expect(windowOpenSpy).toHaveBeenCalledWith('https://plex.example.com', '_blank');
    expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    expect(appClickSpy).toHaveBeenCalledWith(appFixture);
    expect(appClickSpy).toHaveBeenCalledTimes(1);
  });
});
