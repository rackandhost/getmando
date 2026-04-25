import {render, screen} from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {of} from 'rxjs';

import {AppFinderComponent} from './app-finder.component';

import {AppService} from '../../../core/services/app.service';
import {SearchService} from '../../../core/services/search.service';

import {DEFAULT_DASHBOARD_SEARCH_ENGINES, SearchEngine} from '../../../core/models/dashboard.models';

describe('AppFinderComponent', () => {
  const appServiceMock = {
    setSearchQuery: vi.fn(),
  };

  const setup = async (searchEngines: SearchEngine[] = []): Promise<void> => {
    appServiceMock.setSearchQuery.mockReset();

    await render(AppFinderComponent, {
      providers: [
        {
          provide: AppService,
          useValue: appServiceMock,
        },
        {
          provide: SearchService,
          useValue: {
            searchEngines$: of(searchEngines),
          },
        },
      ],
    });
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render the finder with the default placeholder', async () => {
    await setup();

    expect(screen.getByRole('searchbox', {name: 'Search applications'})).toHaveAttribute(
      'placeholder',
      'Search on your applications...',
    );
  });

  it('should propagate search input to AppService when no engine is selected', async () => {
    const user = userEvent.setup();

    await setup();

    const searchInput = screen.getByRole('searchbox', {name: 'Search applications'});

    await user.type(searchInput, 'plex');

    expect(appServiceMock.setSearchQuery).toHaveBeenCalled();
    expect(appServiceMock.setSearchQuery).toHaveBeenLastCalledWith('plex');
  });

  it('should allow selecting a search engine and stop forwarding the query to AppService', async () => {
    const user = userEvent.setup();
    const googleEngine = DEFAULT_DASHBOARD_SEARCH_ENGINES[0];

    await setup([googleEngine]);

    await user.click(screen.getByRole('button', {name: 'Select search engine'}));
    await user.click(screen.getByRole('option', {name: googleEngine.name}));

    const searchInput = screen.getByRole('searchbox', {name: 'Search applications'});

    expect(searchInput).toHaveAttribute(
      'placeholder',
      `Search on the web... (press enter to search on ${googleEngine.name})`,
    );

    await user.type(searchInput, 'grafana');

    expect(appServiceMock.setSearchQuery).not.toHaveBeenCalled();
  });

  it('should search with the selected engine on Enter and clear the query afterwards', async () => {
    const user = userEvent.setup();
    const googleEngine = DEFAULT_DASHBOARD_SEARCH_ENGINES[0];
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await setup([googleEngine]);

    await user.click(screen.getByRole('button', {name: 'Select search engine'}));
    await user.click(screen.getByRole('option', {name: googleEngine.name}));

    const searchInput = screen.getByRole('searchbox', {name: 'Search applications'});

    await user.type(searchInput, 'home assistant');
    await user.keyboard('{Enter}');

    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://www.google.com/search?q=home%20assistant',
      '_blank',
    );
    expect(searchInput).toHaveValue('');
  });

  it('should not open an external search when the selected engine query is empty or blank', async () => {
    const user = userEvent.setup();
    const googleEngine = DEFAULT_DASHBOARD_SEARCH_ENGINES[0];
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await setup([googleEngine]);

    await user.click(screen.getByRole('button', {name: 'Select search engine'}));
    await user.click(screen.getByRole('option', {name: googleEngine.name}));

    const searchInput = screen.getByRole('searchbox', {name: 'Search applications'});

    await user.keyboard('{Enter}');
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(searchInput).toHaveValue('');

    await user.type(searchInput, '   ');
    await user.keyboard('{Enter}');

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(searchInput).toHaveValue('   ');
  });

  it('should clear the local search when switching from app search to an external engine', async () => {
    const user = userEvent.setup();
    const googleEngine = DEFAULT_DASHBOARD_SEARCH_ENGINES[0];

    await setup([googleEngine]);

    const searchInput = screen.getByRole('searchbox', {name: 'Search applications'});

    await user.type(searchInput, 'plex');

    expect(appServiceMock.setSearchQuery).toHaveBeenLastCalledWith('plex');

    await user.click(screen.getByRole('button', {name: 'Select search engine'}));
    await user.click(screen.getByRole('option', {name: googleEngine.name}));

    expect(searchInput).toHaveValue('');
    expect(searchInput).toHaveAttribute(
      'placeholder',
      `Search on the web... (press enter to search on ${googleEngine.name})`,
    );
    expect(appServiceMock.setSearchQuery).toHaveBeenLastCalledWith('');

    const callsBeforeExternalTyping = appServiceMock.setSearchQuery.mock.calls.length;

    await user.type(searchInput, 'grafana');

    expect(appServiceMock.setSearchQuery).toHaveBeenCalledTimes(callsBeforeExternalTyping);
    expect(appServiceMock.setSearchQuery).toHaveBeenLastCalledWith('');
  });

  it('should restore app search when switching back from an external engine', async () => {
    const user = userEvent.setup();
    const googleEngine = DEFAULT_DASHBOARD_SEARCH_ENGINES[0];

    await setup([googleEngine]);

    await user.click(screen.getByRole('button', {name: 'Select search engine'}));
    await user.click(screen.getByRole('option', {name: googleEngine.name}));

    const searchInput = screen.getByRole('searchbox', {name: 'Search applications'});

    await user.type(searchInput, 'grafana');

    expect(appServiceMock.setSearchQuery).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', {name: 'Select search engine'}));
    await user.click(screen.getByRole('option', {name: 'Search on your apps'}));

    expect(searchInput).toHaveAttribute('placeholder', 'Search on your applications...');

    await user.type(searchInput, 'radarr');

    expect(appServiceMock.setSearchQuery).toHaveBeenCalled();
    expect(appServiceMock.setSearchQuery).toHaveBeenLastCalledWith('radarr');
  });

  it('should not open an external search when Enter is pressed in local mode', async () => {
    const user = userEvent.setup();
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await setup();

    const searchInput = screen.getByRole('searchbox', {name: 'Search applications'});

    await user.type(searchInput, 'radarr');
    await user.keyboard('{Enter}');

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(searchInput).toHaveValue('radarr');
    expect(appServiceMock.setSearchQuery).toHaveBeenLastCalledWith('radarr');
  });

  it('should clear the current search from the UI', async () => {
    const user = userEvent.setup();

    await setup();

    const searchInput = screen.getByRole('searchbox', {name: 'Search applications'});

    await user.type(searchInput, 'radarr');
    await user.click(screen.getByLabelText('Clear search'));

    expect(searchInput).toHaveValue('');
    expect(appServiceMock.setSearchQuery).toHaveBeenLastCalledWith('');
  });

  it('should clear search via keyboard Enter on clear icon', async () => {
    const user = userEvent.setup();

    await setup();

    const searchInput = screen.getByRole('searchbox', {name: 'Search applications'});

    await user.type(searchInput, 'radarr');

    const clearIcon = screen.getByLabelText('Clear search');

    clearIcon.focus();
    await user.keyboard('{Enter}');

    expect(searchInput).toHaveValue('');
    expect(appServiceMock.setSearchQuery).toHaveBeenLastCalledWith('');
  });

  it('should clear search via keyboard Space on clear icon', async () => {
    const user = userEvent.setup();

    await setup();

    const searchInput = screen.getByRole('searchbox', {name: 'Search applications'});

    await user.type(searchInput, 'radarr');

    const clearIcon = screen.getByLabelText('Clear search');

    clearIcon.focus();
    await user.keyboard(' ');

    expect(searchInput).toHaveValue('');
    expect(appServiceMock.setSearchQuery).toHaveBeenLastCalledWith('');
  });

  it('should trigger external search via keyboard Enter on search icon', async () => {
    const user = userEvent.setup();
    const googleEngine = DEFAULT_DASHBOARD_SEARCH_ENGINES[0];
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await setup([googleEngine]);

    await user.click(screen.getByRole('button', {name: 'Select search engine'}));
    await user.click(screen.getByRole('option', {name: googleEngine.name}));

    const searchInput = screen.getByRole('searchbox', {name: 'Search applications'});

    await user.type(searchInput, 'home assistant');

    const searchIcon = screen.getByLabelText('Search');

    searchIcon.focus();
    await user.keyboard('{Enter}');

    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://www.google.com/search?q=home%20assistant',
      '_blank',
    );
  });

  it('should trigger external search via keyboard Space on search icon', async () => {
    const user = userEvent.setup();
    const googleEngine = DEFAULT_DASHBOARD_SEARCH_ENGINES[0];
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await setup([googleEngine]);

    await user.click(screen.getByRole('button', {name: 'Select search engine'}));
    await user.click(screen.getByRole('option', {name: googleEngine.name}));

    const searchInput = screen.getByRole('searchbox', {name: 'Search applications'});

    await user.type(searchInput, 'home assistant');

    const searchIcon = screen.getByLabelText('Search');

    searchIcon.focus();
    await user.keyboard(' ');

    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://www.google.com/search?q=home%20assistant',
      '_blank',
    );
  });
});
