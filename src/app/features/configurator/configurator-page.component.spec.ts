import { TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NEVER, Observable, of } from 'rxjs';

import { DashboardConfig, DEFAULT_DASHBOARD_CONFIG } from '../../core/models/dashboard.models';
import { AppService } from '../../core/services/app.service';
import { ConfigExportService } from '../../core/services/config-export.service';
import { ConfigWriteService } from '../../core/services/config-write.service';
import { LoggerService } from '../../core/services/logger.service';
import { NotificationService } from '../../core/services/notification.service';
import { SettingsService } from '../../core/services/settings.service';
import { YamlCodecService } from '../../core/services/yaml-codec.service';
import { MetadataService } from '../../core/services/metadata.service';
import { ThemeService } from '../../core/services/theme.service';
import { MountedConfigResult, YamlLoaderService } from '../../core/services/yaml-loader.service';
import { expectNoAxeViolations } from '../../../testing/a11y';
import { ScrollStateService, type ChromeProbe } from '../../core/scroll/scroll-state.service';
import type { ChromeMode } from '../../core/scroll/scroll-state';
import { METRICS_SOURCE, type MetricsSource } from '../../core/scroll/metrics-source';
import { ConfiguratorPageComponent } from './configurator-page.component';
import { ConfiguratorStore, type StartingPoint } from './configurator.store';

const SECTION_NAV = [
  '01 Starting point',
  '02 Metadata',
  '03 Settings',
  '04 Categories',
  '05 Applications',
  '06 Bookmarks',
  '07 Export',
];
const SECTION_HEADINGS = [
  'Choose a starting point',
  'Metadata',
  'Settings',
  'Categories',
  'Applications',
  'Bookmarks',
  'Export configuration',
];
const SECTION_IDS = [
  'start',
  'metadata',
  'settings',
  'categories',
  'applications',
  'bookmarks',
  'export',
];

describe('ConfiguratorPageComponent', () => {
  const originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const originalUrlDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'URL');
  const draft = signal<DashboardConfig>({
    ...DEFAULT_DASHBOARD_CONFIG,
    metadata: { ...DEFAULT_DASHBOARD_CONFIG.metadata },
    categories: [{ id: 'media', name: 'Media' }],
    applications: [
      {
        id: 'plex',
        name: 'Plex',
        description: 'Media server',
        url: 'https://plex.example.test',
        icon: { type: 'name' as const, value: 'plex' },
        category: 'media',
        openNewTab: true,
        tags: [],
        favorite: false,
        healthCheck: false,
      },
    ],
    bookmarks: [],
  });
  const validationErrors = signal([
    { path: ['applications', '0', 'category'], message: "Category 'missing' does not exist." },
  ]);
  const yamlCodec = { serialize: vi.fn(() => 'metadata:\n  title: Mando\n') };
  const logger = { error: vi.fn() };
  const notifications = { success: vi.fn(), error: vi.fn() };
  const configWrite = {
    hasToken: vi.fn(() => false),
    setToken: vi.fn(),
    save: vi.fn(),
    isWriteEnabled: vi.fn(() => of(true)),
  };
  const appService = { initializeConfig: vi.fn() };
  const yamlLoader = {
    mountedPath: '/config/dashboard.yaml',
    refreshMountedConfig: vi.fn<() => Observable<MountedConfigResult>>(),
  };
  const source = signal<StartingPoint | null>(null);

  const store = {
    draft,
    source,
    validationErrors,
    updateMetadata: vi.fn(),
    updateSettings: vi.fn(),
    addCategory: vi.fn(),
    addApplication: vi.fn(),
    addBookmark: vi.fn(),
    updateCategory: vi.fn(),
    updateApplication: vi.fn(),
    updateBookmark: vi.fn(),
    removeCategory: vi.fn(),
    removeApplication: vi.fn(),
    removeBookmark: vi.fn(),
    moveCategory: vi.fn(),
    moveApplication: vi.fn(),
    moveBookmark: vi.fn(),
    validate: vi.fn(() => false),
    toDashboardConfig: vi.fn((): DashboardConfig | undefined => undefined),
    canLoadMountedConfig: vi.fn(() => false),
    startEmpty: vi.fn(),
    loadMountedConfig: vi.fn(),
    importLocalYaml: vi.fn(),
    markSaved: vi.fn(),
    reportServerValidationErrors: vi.fn(),
  };

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
    vi.restoreAllMocks();

    if (originalFetchDescriptor) {
      Object.defineProperty(globalThis, 'fetch', originalFetchDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'fetch');
    }

    if (originalUrlDescriptor) {
      Object.defineProperty(globalThis, 'URL', originalUrlDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'URL');
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    validationErrors.set([
      { path: ['applications', '0', 'category'], message: "Category 'missing' does not exist." },
    ]);
    store.validate.mockReturnValue(false);
    store.toDashboardConfig.mockReturnValue(undefined);
    store.canLoadMountedConfig.mockReturnValue(false);
    configWrite.hasToken.mockReturnValue(false);
    configWrite.isWriteEnabled.mockReturnValue(of(true));
    yamlLoader.refreshMountedConfig.mockReturnValue(of({ status: 'unavailable', message: 'n/a' }));
    source.set(null);
  });

  function defaultProviders() {
    return [
      { provide: ConfiguratorStore, useValue: store },
      { provide: AppService, useValue: appService },
      {
        provide: ThemeService,
        useValue: { isDark: signal(true), toggleTheme: vi.fn() },
      },
      {
        provide: MetadataService,
        useValue: { metadata: signal(DEFAULT_DASHBOARD_CONFIG.metadata) },
      },
      { provide: YamlLoaderService, useValue: yamlLoader },
      { provide: ConfigWriteService, useValue: configWrite },
    ];
  }

  function exportProviders() {
    return [
      { provide: YamlCodecService, useValue: yamlCodec },
      { provide: LoggerService, useValue: logger },
      { provide: NotificationService, useValue: notifications },
      { provide: ConfigWriteService, useValue: configWrite },
      ConfigExportService,
    ];
  }

  it('renders the page header itself, ahead of the main landmark', async () => {
    await render(ConfiguratorPageComponent, {
      providers: defaultProviders(),
    });

    const banner = screen.getByRole('banner');
    const main = screen.getByRole('main');

    expect(banner).toHaveTextContent(DEFAULT_DASHBOARD_CONFIG.metadata.title);
    expect(banner.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main).not.toContainElement(banner);
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
  });

  it('does not offer load mounted YAML when mounted configuration is unavailable', async () => {
    await render(ConfiguratorPageComponent, {
      providers: defaultProviders(),
    });

    expect(screen.queryByRole('button', { name: 'Load mounted YAML' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start empty' })).toBeInTheDocument();
    expect(screen.getByLabelText('Import local YAML')).toBeInTheDocument();
  });

  it('starts empty, loads mounted YAML, and imports a local YAML file from explicit entry controls', async () => {
    const user = userEvent.setup();
    store.canLoadMountedConfig.mockReturnValue(true);
    await render(ConfiguratorPageComponent, {
      providers: defaultProviders(),
    });

    await user.click(screen.getByRole('button', { name: 'Start empty' }));
    await user.click(screen.getByRole('button', { name: 'Load mounted YAML' }));
    await user.upload(
      screen.getByLabelText('Import local YAML'),
      new File(['metadata:\n  title: Imported\n'], 'dashboard.yaml', { type: 'text/yaml' }),
    );

    expect(store.startEmpty).toHaveBeenCalledOnce();
    expect(store.loadMountedConfig).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(store.importLocalYaml).toHaveBeenCalledWith('metadata:\n  title: Imported\n'),
    );
  });

  it('edits schema-backed metadata and settings fields from accessible controls', async () => {
    const user = userEvent.setup();
    await render(ConfiguratorPageComponent, {
      providers: defaultProviders(),
    });

    await user.clear(screen.getByLabelText('Dashboard description'));
    await user.type(screen.getByLabelText('Dashboard description'), 'Updated description');
    await user.clear(screen.getByLabelText('Items per row'));
    await user.type(screen.getByLabelText('Items per row'), '6');
    await user.click(screen.getByRole('switch', { name: 'Show date' }));
    await user.click(screen.getByRole('switch', { name: 'YouTube' }));

    expect(store.updateMetadata).toHaveBeenLastCalledWith({ description: 'Updated description' });
    expect(store.updateSettings).toHaveBeenCalledWith({ itemsPerRow: 6 });
    expect(store.updateSettings).toHaveBeenCalledWith({ showDate: true });
    expect(store.updateSettings).toHaveBeenCalledWith({ searchEngines: ['youtube'] });
  });

  it('blocks copy and download when the draft is invalid', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    await render(ConfiguratorPageComponent, {
      providers: [...defaultProviders(), ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Copy YAML' }));
    await user.click(screen.getByRole('button', { name: 'Download YAML' }));

    expect(store.toDashboardConfig).toHaveBeenCalledTimes(2);
    expect(yamlCodec.serialize).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
    expect(notifications.success).not.toHaveBeenCalled();
  });

  it('copies canonical YAML and confirms the successful browser-only export', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn();
    store.toDashboardConfig.mockReturnValue(draft());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetch });
    await render(ConfiguratorPageComponent, {
      providers: [...defaultProviders(), ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Copy YAML' }));

    expect(yamlCodec.serialize).toHaveBeenCalledWith(draft());
    expect(writeText).toHaveBeenCalledWith('metadata:\n  title: Mando\n');
    expect(notifications.success).toHaveBeenCalledWith('YAML copied to the clipboard.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('downloads canonical YAML as dashboard.yaml and confirms no server write', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:dashboard');
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const fetch = vi.fn();
    store.toDashboardConfig.mockReturnValue(draft());
    Object.defineProperty(globalThis, 'URL', {
      configurable: true,
      value: { createObjectURL, revokeObjectURL },
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetch });
    await render(ConfiguratorPageComponent, {
      providers: [...defaultProviders(), ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Download YAML' }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(notifications.success).toHaveBeenCalledWith('YAML downloaded as dashboard.yaml.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not attempt a server save or prompt for a token when the draft is invalid', async () => {
    const user = userEvent.setup();
    await render(ConfiguratorPageComponent, {
      providers: [...defaultProviders(), ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(configWrite.save).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Write token')).not.toBeInTheDocument();
  });

  describe('when the server has no write token', () => {
    it('disables Save, says why, and leaves Copy and Download available', async () => {
      const user = userEvent.setup();
      configWrite.isWriteEnabled.mockReturnValue(of(false));
      store.toDashboardConfig.mockReturnValue(draft());
      await render(ConfiguratorPageComponent, {
        providers: [...defaultProviders(), ...exportProviders()],
      });

      const save = screen.getByRole('button', { name: 'Save' });
      expect(save).toBeDisabled();
      expect(save).toHaveAccessibleDescription(/CONFIG_WRITE_TOKEN/);
      expect(screen.getByRole('button', { name: 'Copy YAML' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Download YAML' })).toBeEnabled();

      await user.click(save);

      expect(configWrite.save).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Write token')).not.toBeInTheDocument();
    });

    it.each([
      ['has a write token', of(true)],
      ['has not answered yet', NEVER],
    ])('keeps Save available and says nothing while the server %s', async (_label, capability) => {
      configWrite.isWriteEnabled.mockReturnValue(capability);
      await render(ConfiguratorPageComponent, {
        providers: [...defaultProviders(), ...exportProviders()],
      });

      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
      expect(screen.queryByText(/CONFIG_WRITE_TOKEN on the server/)).not.toBeInTheDocument();
    });
  });

  describe('revealing the errors', () => {
    const scrollIntoView = vi.fn();

    beforeEach(() => {
      scrollIntoView.mockClear();
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        value: scrollIntoView,
      });
    });

    afterEach(() => {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    });

    it.each(['Copy YAML', 'Download YAML', 'Save'])(
      'scrolls the error summary into view when %s finds an invalid draft',
      async (action) => {
        const user = userEvent.setup();
        await render(ConfiguratorPageComponent, {
          providers: [...defaultProviders(), ...exportProviders()],
        });

        await user.click(screen.getByRole('button', { name: action }));

        await waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce());
        expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('alert'));
      },
    );

    it('scrolls the error summary into view when the server rejects the configuration', async () => {
      const user = userEvent.setup();
      store.toDashboardConfig.mockReturnValue(draft());
      configWrite.hasToken.mockReturnValue(true);
      configWrite.save.mockReturnValue(
        of({ status: 'invalid', errors: [{ path: ['metadata', 'title'], message: 'Bad title.' }] }),
      );
      await render(ConfiguratorPageComponent, {
        providers: [...defaultProviders(), ...exportProviders()],
      });

      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce());
      expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('alert'));
    });

    it('does not scroll when the draft is valid and the export goes through', async () => {
      const user = userEvent.setup();
      store.toDashboardConfig.mockReturnValue(draft());
      validationErrors.set([]);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
      });
      await render(ConfiguratorPageComponent, {
        providers: [...defaultProviders(), ...exportProviders()],
      });

      await user.click(screen.getByRole('button', { name: 'Copy YAML' }));

      await waitFor(() => expect(notifications.success).toHaveBeenCalled());
      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });

  it('prompts for a write token before the first server save', async () => {
    const user = userEvent.setup();
    store.validate.mockReturnValue(true);
    store.toDashboardConfig.mockReturnValue(draft());
    await render(ConfiguratorPageComponent, {
      providers: [...defaultProviders(), ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByLabelText('Write token')).toBeInTheDocument();
    expect(configWrite.save).not.toHaveBeenCalled();
  });

  it('shows the token panel with a password field, help naming CONFIG_WRITE_TOKEN, and both actions', async () => {
    const user = userEvent.setup();
    store.toDashboardConfig.mockReturnValue(draft());
    await render(ConfiguratorPageComponent, {
      providers: [...defaultProviders(), ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const token = screen.getByLabelText('Write token');
    expect(token).toHaveAttribute('type', 'password');
    expect(token).toHaveAttribute('autocomplete', 'off');
    expect(token).toHaveAccessibleDescription(/CONFIG_WRITE_TOKEN/);
    expect(screen.getByRole('button', { name: 'Save token & save' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('closes the token panel on Cancel without storing or saving anything, and forgets what was typed', async () => {
    const user = userEvent.setup();
    store.toDashboardConfig.mockReturnValue(draft());
    await render(ConfiguratorPageComponent, {
      providers: [...defaultProviders(), ...exportProviders()],
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.type(screen.getByLabelText('Write token'), 'half-typed');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Write token')).not.toBeInTheDocument();
    expect(configWrite.setToken).not.toHaveBeenCalled();
    expect(configWrite.save).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByLabelText('Write token')).toHaveValue('');
  });

  it('offers Copy YAML, Download YAML and Save in the Export section', async () => {
    await render(ConfiguratorPageComponent, { providers: defaultProviders() });

    const section = document.getElementById('section-export') as HTMLElement;

    expect(
      within(section)
        .getAllByRole('button')
        .map((button) => button.textContent?.trim()),
    ).toEqual(['Copy YAML', 'Download YAML', 'Save']);
  });

  it('keeps the write-token prompt free of detectable AXE violations', async () => {
    const user = userEvent.setup();
    store.validate.mockReturnValue(true);
    store.toDashboardConfig.mockReturnValue(draft());
    const view = await render(ConfiguratorPageComponent, {
      providers: [...defaultProviders(), ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByLabelText('Write token')).toBeInTheDocument();

    await expectNoAxeViolations(view.container);
  });

  it('stores the entered token and saves once confirmed', async () => {
    const user = userEvent.setup();
    store.validate.mockReturnValue(true);
    store.toDashboardConfig.mockReturnValue(draft());
    configWrite.save.mockReturnValue(of({ status: 'saved' }));
    await render(ConfiguratorPageComponent, {
      providers: [...defaultProviders(), ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.type(screen.getByLabelText('Write token'), 'shared-secret');
    await user.click(screen.getByRole('button', { name: 'Save token & save' }));

    expect(configWrite.setToken).toHaveBeenCalledWith('shared-secret');
    expect(configWrite.save).toHaveBeenCalledWith(draft());
    await waitFor(() => expect(store.markSaved).toHaveBeenCalledOnce());
    expect(notifications.success).toHaveBeenCalledWith('Configuration saved to the server.');
    expect(screen.queryByLabelText('Write token')).not.toBeInTheDocument();
  });

  it('saves directly without prompting when a token is already stored', async () => {
    const user = userEvent.setup();
    store.validate.mockReturnValue(true);
    store.toDashboardConfig.mockReturnValue(draft());
    configWrite.hasToken.mockReturnValue(true);
    configWrite.save.mockReturnValue(of({ status: 'saved' }));
    await render(ConfiguratorPageComponent, {
      providers: [...defaultProviders(), ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.queryByLabelText('Write token')).not.toBeInTheDocument();
    await waitFor(() => expect(configWrite.save).toHaveBeenCalledWith(draft()));
    await waitFor(() => expect(store.markSaved).toHaveBeenCalledOnce());
    expect(appService.initializeConfig).not.toHaveBeenCalled();
  });

  it('refreshes the live dashboard config after a successful save', async () => {
    const user = userEvent.setup();
    const freshConfig = { ...draft(), metadata: { ...draft().metadata, title: 'Refreshed' } };
    store.validate.mockReturnValue(true);
    store.toDashboardConfig.mockReturnValue(draft());
    configWrite.hasToken.mockReturnValue(true);
    configWrite.save.mockReturnValue(of({ status: 'saved' }));
    yamlLoader.refreshMountedConfig.mockReturnValue(of({ status: 'valid', config: freshConfig }));
    await render(ConfiguratorPageComponent, {
      providers: [...defaultProviders(), ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(appService.initializeConfig).toHaveBeenCalledWith(freshConfig));
  });

  it('reopens the token prompt and surfaces the rejection when the server refuses the token', async () => {
    const user = userEvent.setup();
    store.validate.mockReturnValue(true);
    store.toDashboardConfig.mockReturnValue(draft());
    configWrite.hasToken.mockReturnValue(true);
    configWrite.save.mockReturnValue(
      of({ status: 'unauthorized', message: 'The write token was rejected.' }),
    );
    await render(ConfiguratorPageComponent, {
      providers: [...defaultProviders(), ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(notifications.error).toHaveBeenCalledWith('The write token was rejected.'),
    );
    await waitFor(() => expect(screen.getByLabelText('Write token')).toBeInTheDocument());
    expect(store.markSaved).not.toHaveBeenCalled();
  });

  it('surfaces a plain save error notification without touching the draft', async () => {
    const user = userEvent.setup();
    store.validate.mockReturnValue(true);
    store.toDashboardConfig.mockReturnValue(draft());
    configWrite.hasToken.mockReturnValue(true);
    configWrite.save.mockReturnValue(of({ status: 'error', message: 'Disk full.' }));
    await render(ConfiguratorPageComponent, {
      providers: [...defaultProviders(), ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(notifications.error).toHaveBeenCalledWith('Disk full.'));
    expect(store.markSaved).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Write token')).not.toBeInTheDocument();
  });

  it('reports server-side validation errors through the same error summary', async () => {
    const user = userEvent.setup();
    const errors = [{ path: ['applications', '0', 'category'], message: "Category 'x' missing." }];
    store.validate.mockReturnValue(true);
    store.toDashboardConfig.mockReturnValue(draft());
    configWrite.hasToken.mockReturnValue(true);
    configWrite.save.mockReturnValue(of({ status: 'invalid', errors }));
    await render(ConfiguratorPageComponent, {
      providers: [...defaultProviders(), ...exportProviders()],
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(store.reportServerValidationErrors).toHaveBeenCalledWith(errors));
    expect(notifications.error).toHaveBeenCalled();
  });

  it('associates application icon validation feedback with the selected icon value field', async () => {
    validationErrors.set([
      { path: ['applications', '0', 'icon', 'value'], message: 'Icon value cannot be empty.' },
    ]);
    await render(ConfiguratorPageComponent, {
      providers: defaultProviders(),
    });

    expect(screen.getByLabelText('Icon name for Plex')).toHaveAttribute(
      'aria-describedby',
      'application-icon-name-help-0 error-applications-0-icon-value',
    );
    expect(screen.getByText('Icon value cannot be empty.', { selector: 'p' })).toHaveAttribute(
      'id',
      'error-applications-0-icon-value',
    );
    expect(screen.getByRole('link', { name: 'Icon value cannot be empty.' })).toHaveAttribute(
      'href',
      `${window.location.pathname}#field-applications-0-icon-value`,
    );
  });

  it('associates a settings validation error with its field', async () => {
    validationErrors.set([
      { path: ['settings', 'itemsPerRow'], message: 'Items per row must be between 1 and 10.' },
    ]);
    await render(ConfiguratorPageComponent, {
      providers: defaultProviders(),
    });

    const field = screen.getByLabelText(/Items per row/);
    expect(field).toHaveAttribute('aria-describedby', 'error-settings-itemsPerRow');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('Items per row must be between 1 and 10.', { selector: 'p' }),
    ).toHaveAttribute('id', 'error-settings-itemsPerRow');
    expect(
      screen.getByRole('link', { name: 'Items per row must be between 1 and 10.' }),
    ).toHaveAttribute('href', `${window.location.pathname}#field-settings-itemsPerRow`);
  });

  it('renders labeled settings fields and associates an actionable error summary with invalid fields', async () => {
    await render(ConfiguratorPageComponent, {
      providers: defaultProviders(),
    });

    expect(screen.getByRole('heading', { name: 'Configuration editor' })).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard title')).toHaveValue('Mando');
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(screen.getByRole('alert')).toHaveTextContent("Category 'missing' does not exist.");
    expect(screen.getByLabelText('Application category for Plex')).toHaveAttribute(
      'aria-describedby',
      'error-applications-0-category',
    );
    expect(
      screen.getByRole('link', { name: "Category 'missing' does not exist." }),
    ).toHaveAttribute('href', `${window.location.pathname}#field-applications-0-category`);
  });

  describe('error summary links', () => {
    const scrollIntoView = vi.fn();

    beforeEach(() => {
      scrollIntoView.mockClear();
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        value: scrollIntoView,
      });
    });

    afterEach(() => {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
      window.history.pushState({}, '', '/');
    });

    it('keep the configurator path in front of the anchor, so they never resolve against the app root', async () => {
      window.history.pushState({}, '', '/configure');
      await render(ConfiguratorPageComponent, { providers: defaultProviders() });

      expect(
        screen.getByRole('link', { name: "Category 'missing' does not exist." }),
      ).toHaveAttribute('href', '/configure#field-applications-0-category');
    });

    it('take the user to the section of an error whose field does not exist, without leaving the page', async () => {
      const user = userEvent.setup();
      validationErrors.set([
        { path: ['categories'], message: 'At least one category is required.' },
      ]);
      await render(ConfiguratorPageComponent, { providers: defaultProviders() });
      const address = window.location.href;

      await user.click(screen.getByRole('link', { name: 'At least one category is required.' }));

      expect(scrollIntoView).toHaveBeenCalledOnce();
      expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('section-categories'));
      expect(screen.getByRole('heading', { name: 'Categories' })).toHaveFocus();
      expect(window.location.href).toBe(address);
    });
  });

  it('keeps the editor keyboard-accessible and free of detectable AXE violations', async () => {
    const user = userEvent.setup();
    const view = await render(ConfiguratorPageComponent, {
      providers: defaultProviders(),
    });

    await user.tab();
    expect(screen.getByRole('link', { name: 'Open configurator' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toHaveFocus();
    // The section navigation precedes the content it navigates, as it does on screen.
    for (const name of SECTION_NAV) {
      await user.tab();
      expect(screen.getByRole('link', { name })).toHaveFocus();
    }
    await user.tab();
    expect(screen.getByRole('button', { name: 'Start empty' })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Import local YAML')).toHaveFocus();

    await expectNoAxeViolations(view.container);
  });

  it('writes bookmark URL edits through the typed draft store', async () => {
    const user = userEvent.setup();
    draft.set({
      ...draft(),
      bookmarks: [
        {
          id: 'docs',
          name: 'Docs',
          description: '',
          url: 'https://docs.example.test',
          icon: { type: 'initials', value: 'DO' },
          openNewTab: true,
          tags: [],
        },
      ],
    });
    await render(ConfiguratorPageComponent, {
      providers: defaultProviders(),
    });

    const url = screen.getByLabelText('Bookmark URL for Docs');
    await user.clear(url);
    await user.type(url, 'https://handbook.example.test');

    expect(store.updateBookmark).toHaveBeenLastCalledWith(0, {
      url: 'https://handbook.example.test',
    });
  });

  describe('page layout', () => {
    it('presents the setup eyebrow, the page heading and its description', async () => {
      await render(ConfiguratorPageComponent, { providers: defaultProviders() });

      expect(screen.getByText('DASHBOARD SETUP')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Configuration editor' })).toBeInTheDocument();
      expect(screen.getByText(/Your changes remain in this browser/)).toBeInTheDocument();
    });

    it('lists the seven numbered sections in the side navigation, in order', async () => {
      await render(ConfiguratorPageComponent, { providers: defaultProviders() });

      const nav = screen.getByRole('navigation', { name: 'Configurator sections' });
      const items = within(nav).getAllByRole('link');

      expect(items.map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual(
        SECTION_NAV,
      );
    });

    it('renders each section as a region labelled by its heading, numbered and in the same order', async () => {
      await render(ConfiguratorPageComponent, { providers: defaultProviders() });

      const nav = screen.getByRole('navigation', { name: 'Configurator sections' });
      let previous: HTMLElement | undefined;

      within(nav)
        .getAllByRole('link')
        .forEach((link, index) => {
          const section = document.getElementById(link.getAttribute('href')?.split('#')[1] ?? '');
          expect(section, SECTION_NAV[index]).toBeInstanceOf(HTMLElement);
          if (!section) return;

          const heading = document.getElementById(section.getAttribute('aria-labelledby') ?? '');
          expect(heading).toHaveTextContent(SECTION_HEADINGS[index]);
          expect(within(section).getByText(`0${index + 1}`)).toBeInTheDocument();
          if (previous) {
            expect(
              previous.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy();
          }
          previous = section;
        });
    });

    it('points the section links at the configurator page itself, not at the app root', async () => {
      window.history.pushState({}, '', '/configure');
      try {
        await render(ConfiguratorPageComponent, { providers: defaultProviders() });

        const nav = screen.getByRole('navigation', { name: 'Configurator sections' });
        expect(
          within(nav)
            .getAllByRole('link')
            .map((link) => link.getAttribute('href')),
        ).toEqual(SECTION_IDS.map((id) => `/configure#section-${id}`));
      } finally {
        window.history.pushState({}, '', '/');
      }
    });

    describe('navigating to a section', () => {
      const scrollIntoView = vi.fn();

      beforeEach(() => {
        scrollIntoView.mockClear();
        // jsdom has no layout and does not implement scrolling.
        Object.defineProperty(Element.prototype, 'scrollIntoView', {
          configurable: true,
          writable: true,
          value: scrollIntoView,
        });
      });

      afterEach(() => {
        Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
      });

      it('scrolls the section into view and focuses its heading, without leaving the page', async () => {
        const user = userEvent.setup();
        await render(ConfiguratorPageComponent, { providers: defaultProviders() });
        const address = window.location.href;

        await user.click(screen.getByRole('link', { name: '05 Applications' }));

        expect(scrollIntoView).toHaveBeenCalledOnce();
        expect(scrollIntoView.mock.contexts[0]).toBe(
          document.getElementById('section-applications'),
        );
        expect(screen.getByRole('heading', { name: 'Applications' })).toHaveFocus();
        expect(window.location.href).toBe(address);
      });
    });
  });

  describe('sticky header', () => {
    const mode: WritableSignal<ChromeMode> = signal('static');
    const dispose = vi.fn();
    const register = vi.fn((_probe: ChromeProbe) => ({ mode: mode.asReadonly(), dispose }));

    beforeEach(() => {
      mode.set('static');
      register.mockClear();
      dispose.mockClear();
    });

    const renderWithDock = () =>
      render(ConfiguratorPageComponent, {
        providers: [...defaultProviders(), { provide: ScrollStateService, useValue: { register } }],
      });
    const dock = () => screen.getByRole('banner').closest<HTMLElement>('[data-dock]');
    const padding = () => getComputedStyle(screen.getByRole('banner')).paddingTop;

    it('registers with the scroll state, losing 20 px when it compacts, and is released on destroy', async () => {
      const view = await renderWithDock();

      expect(register).toHaveBeenCalledOnce();
      const probe = register.mock.calls[0][0];
      expect(probe.id).toBe('configurator-header');
      // Padding 24 → 14 on both sides.
      expect(probe.compactDelta()).toBe(20);
      expect(probe.minViewportHeight).toBe(500);

      view.fixture.destroy();
      expect(dispose).toHaveBeenCalledOnce();
    });

    it('stays at 24 px padding while static or at the top, and gains 14 px padding once scrolled', async () => {
      await renderWithDock();

      expect(dock()).toHaveAttribute('data-dock', 'static');
      expect(padding()).toBe('24px');

      mode.set('top');
      await waitFor(() => expect(dock()).toHaveAttribute('data-dock', 'top'));
      expect(padding()).toBe('24px');

      mode.set('scrolled');
      await waitFor(() => expect(dock()).toHaveAttribute('data-dock', 'scrolled'));
      expect(padding()).toBe('14px');
    });
  });

  describe('scroll-spy navigation', () => {
    const frames: (() => void)[] = [];
    const scrollListeners = new Set<() => void>();
    const metrics = { scrollY: 0, docHeight: 3000, viewportHeight: 900 };
    const source: MetricsSource = {
      scrollY: () => metrics.scrollY,
      docHeight: () => metrics.docHeight,
      viewportHeight: () => metrics.viewportHeight,
      prefersReducedMotion: () => false,
      now: () => 0,
      onScroll: (listener) => {
        scrollListeners.add(listener);
        return () => scrollListeners.delete(listener);
      },
      onLayoutChange: () => () => undefined,
      observeSize: () => () => undefined,
      requestFrame: (run) => {
        frames.push(run);
        return () => undefined;
      },
      after: () => () => undefined,
    };
    const flushFrames = () => frames.splice(0).forEach((run) => run());

    beforeEach(() => {
      frames.length = 0;
      scrollListeners.clear();
      Object.assign(metrics, { scrollY: 0, docHeight: 3000, viewportHeight: 900 });
    });

    const renderSpied = () =>
      render(ConfiguratorPageComponent, {
        providers: [
          ...defaultProviders(),
          { provide: METRICS_SOURCE, useValue: source },
          {
            provide: ScrollStateService,
            useValue: { register: () => ({ mode: signal('static'), dispose: vi.fn() }) },
          },
        ],
      });

    /**
     * jsdom has no layout: give each section the top edge it would have in the viewport. Sections left out
     * are far below it.
     */
    const placeSections = (tops: Record<string, number>) => {
      for (const id of SECTION_IDS) {
        const element = document.getElementById(`section-${id}`);
        const top = tops[id] ?? 5000;
        if (element) element.getBoundingClientRect = () => ({ top }) as DOMRect;
      }
    };
    const scrollTo = (scrollY: number) => {
      metrics.scrollY = scrollY;
      scrollListeners.forEach((listener) => listener());
      flushFrames();
    };
    const currentItems = () =>
      within(screen.getByRole('navigation', { name: 'Configurator sections' }))
        .getAllByRole('link')
        .filter((link) => link.getAttribute('aria-current') === 'true')
        .map((link) => link.textContent?.replace(/\s+/g, ' ').trim());

    it('marks the first section as current before anything is measured', async () => {
      await renderSpied();

      expect(currentItems()).toEqual(['01 Starting point']);
    });

    it('marks exactly the last section whose top has passed 140 px as current', async () => {
      await renderSpied();
      flushFrames();
      placeSections({ start: -900, metadata: -500, settings: 100, categories: 520 });

      scrollTo(600);

      await waitFor(() => expect(currentItems()).toEqual(['03 Settings']));
    });

    it('marks the last section as current at the bottom of the page even though its top is below 140 px', async () => {
      await renderSpied();
      flushFrames();
      placeSections({ bookmarks: -300, export: 400 });

      scrollTo(2100);

      await waitFor(() => expect(currentItems()).toEqual(['07 Export']));
    });

    it('measures only in an animation frame, never inside the scroll event', async () => {
      await renderSpied();
      flushFrames();
      placeSections({ start: -900, metadata: 100, settings: 520 });

      metrics.scrollY = 600;
      scrollListeners.forEach((listener) => listener());
      expect(currentItems()).toEqual(['01 Starting point']);

      flushFrames();
      await waitFor(() => expect(currentItems()).toEqual(['02 Metadata']));
    });

    it('stops listening to the scroll when the page is destroyed', async () => {
      const view = await renderSpied();
      expect(scrollListeners.size).toBeGreaterThan(0);

      view.fixture.destroy();

      expect(scrollListeners.size).toBe(0);
    });

    describe('as a chip bar (up to 900 px wide)', () => {
      const originalWidth = window.innerWidth;
      const resizeTo = (width: number) =>
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });

      afterEach(() => {
        resizeTo(originalWidth);
        document.documentElement.style.removeProperty('scroll-padding-top');
      });

      const list = () =>
        within(screen.getByRole('navigation', { name: 'Configurator sections' })).getByRole('list');

      it('scrolls the row sideways on the vertical wheel and fades only the side that overflows', async () => {
        await renderSpied();
        Object.defineProperty(list(), 'scrollWidth', { configurable: true, value: 614 });
        Object.defineProperty(list(), 'clientWidth', { configurable: true, value: 350 });

        fireEvent.scroll(list());
        expect(list()).toHaveAttribute('data-fade', 'end');

        fireEvent.wheel(list(), { deltaY: 100 });
        expect(list().scrollLeft).toBe(100);
        fireEvent.scroll(list());
        expect(list()).toHaveAttribute('data-fade', 'both');
      });

      it('treats a section as reached 200 px from the top instead of 140 px', async () => {
        await renderSpied();
        flushFrames();
        placeSections({ start: -900, metadata: 180, settings: 520 });

        scrollTo(300);
        await waitFor(() => expect(currentItems()).toEqual(['01 Starting point']));

        resizeTo(800);
        scrollTo(301);
        await waitFor(() => expect(currentItems()).toEqual(['02 Metadata']));
      });

      it('leaves sections 20 px under the header on a wide page and clear of the bar on a narrow one', async () => {
        await renderSpied();
        const nav = screen.getByRole('navigation', { name: 'Configurator sections' });
        nav.getBoundingClientRect = () => ({ top: 96, bottom: 150, height: 54 }) as DOMRect;
        document.documentElement.style.scrollPaddingTop = '87px';
        const margin = () =>
          document
            .getElementById('section-start')
            ?.closest<HTMLElement>('[style*="section-margin"]')
            ?.style.getPropertyValue('--section-margin');

        flushFrames();
        await waitFor(() => expect(margin()).toBe('20px'));

        resizeTo(800);
        scrollTo(10);
        // Stuck bar bottom (96 + 54) + 16 of air, minus the 87 px the header's scroll padding already covers.
        await waitFor(() => expect(margin()).toBe('79px'));
      });
    });
  });

  describe('starting point', () => {
    const startSection = () => document.getElementById('section-start') as HTMLElement;
    const renderPage = () => render(ConfiguratorPageComponent, { providers: defaultProviders() });

    it('offers the mounted YAML with its path as the caption, only when it is valid', async () => {
      store.canLoadMountedConfig.mockReturnValue(true);
      await renderPage();

      const card = screen.getByRole('button', { name: 'Load mounted YAML' });

      expect(card).toHaveAccessibleDescription('/config/dashboard.yaml');
    });

    it('keeps Start empty and Import local YAML when there is no valid mounted YAML', async () => {
      await renderPage();

      expect(screen.queryByRole('button', { name: 'Load mounted YAML' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start empty' })).toBeInTheDocument();
      expect(screen.getByLabelText('Import local YAML')).toBeInTheDocument();
    });

    it('exposes the chosen starting point with aria-pressed', async () => {
      store.canLoadMountedConfig.mockReturnValue(true);
      await renderPage();
      const empty = screen.getByRole('button', { name: 'Start empty' });
      const mounted = screen.getByRole('button', { name: 'Load mounted YAML' });

      expect(empty).toHaveAttribute('aria-pressed', 'false');
      expect(mounted).toHaveAttribute('aria-pressed', 'false');

      source.set('mounted');
      await waitFor(() => expect(mounted).toHaveAttribute('aria-pressed', 'true'));
      expect(empty).toHaveAttribute('aria-pressed', 'false');

      source.set('empty');
      await waitFor(() => expect(empty).toHaveAttribute('aria-pressed', 'true'));
      expect(mounted).toHaveAttribute('aria-pressed', 'false');
    });

    it('says the import card is selected once a file was imported', async () => {
      await renderPage();
      const input = screen.getByLabelText('Import local YAML');
      expect(input).toHaveAccessibleDescription('Choose a .yaml file');

      source.set('import');

      await waitFor(() => expect(input).toHaveAccessibleDescription(/Selected/));
    });

    it('lists the errors in an alert panel inside the section, below the option cards, with the field path in front of each', async () => {
      validationErrors.set([
        { path: ['applications', '6', 'category'], message: "Category 'iot' does not exist." },
        { path: ['settings', 'itemsPerRow'], message: 'Items per row must be between 1 and 10.' },
      ]);
      await renderPage();

      const panel = within(startSection()).getByRole('alert');
      const cards = within(startSection()).getByRole('button', { name: 'Start empty' });

      expect(
        within(panel).getByRole('heading', { name: 'Fix the following errors' }),
      ).toBeVisible();
      expect(
        within(panel)
          .getAllByRole('listitem')
          .map((item) => item.textContent?.trim()),
      ).toEqual([
        "applications[6].category — Category 'iot' does not exist.",
        'settings.itemsPerRow — Items per row must be between 1 and 10.',
      ]);
      expect(cards.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('shows an error without a field path as its message alone', async () => {
      validationErrors.set([{ path: [], message: 'Invalid YAML.' }]);
      await renderPage();

      const [item] = within(within(startSection()).getByRole('alert')).getAllByRole('listitem');

      expect(item.textContent?.trim()).toBe('Invalid YAML.');
    });

    it('shows no panel without errors', async () => {
      validationErrors.set([]);
      await renderPage();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('switches and segmented controls', () => {
    beforeEach(() => {
      draft.set({
        ...draft(),
        settings: { ...draft().settings, showSeconds: false, searchEngines: [] },
      });
    });

    it('presents every display option and search engine as a named switch reflecting the draft', async () => {
      draft.set({
        ...draft(),
        settings: { ...draft().settings, showSeconds: true, searchEngines: ['duckduckgo'] },
      });
      await render(ConfiguratorPageComponent, { providers: defaultProviders() });

      const names = within(document.getElementById('section-settings') as HTMLElement)
        .getAllByRole('switch')
        .map((control) => control.textContent?.trim());

      expect(names).toEqual([
        'Show seconds',
        'Show date',
        'Allow bookmarks',
        'Show “Apps” category',
        'Show descriptions',
        'Show labels',
        'Google',
        'DuckDuckGo',
        'Startpage',
        'YouTube',
      ]);
      expect(screen.getByRole('switch', { name: 'Show seconds' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(screen.getByRole('switch', { name: 'DuckDuckGo' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(screen.getByRole('switch', { name: 'Google' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });

    it('toggles Show seconds with the Space key and writes the same draft field as before', async () => {
      const user = userEvent.setup();
      await render(ConfiguratorPageComponent, { providers: defaultProviders() });

      screen.getByRole('switch', { name: 'Show seconds' }).focus();
      await user.keyboard(' ');

      expect(store.updateSettings).toHaveBeenCalledExactlyOnceWith({ showSeconds: true });
    });

    it('adds and removes a search engine through its switch', async () => {
      const user = userEvent.setup();
      draft.set({ ...draft(), settings: { ...draft().settings, searchEngines: ['google'] } });
      await render(ConfiguratorPageComponent, { providers: defaultProviders() });

      await user.click(screen.getByRole('switch', { name: 'Startpage' }));
      expect(store.updateSettings).toHaveBeenLastCalledWith({
        searchEngines: ['google', 'startpage'],
      });

      await user.click(screen.getByRole('switch', { name: 'Google' }));
      expect(store.updateSettings).toHaveBeenLastCalledWith({ searchEngines: [] });
    });

    it('chooses the theme with the arrow keys: Dark then right arrow is Auto', async () => {
      const user = userEvent.setup();
      await render(ConfiguratorPageComponent, { providers: defaultProviders() });
      const group = screen.getByRole('radiogroup', { name: 'Theme' });

      expect(
        within(group)
          .getAllByRole('radio')
          .map((r) => r.textContent?.trim()),
      ).toEqual(['Light', 'Dark', 'Auto']);
      await user.click(within(group).getByRole('radio', { name: 'Dark' }));
      screen.getByRole('radio', { name: 'Dark' }).focus();
      await user.keyboard('{ArrowRight}');

      expect(store.updateSettings).toHaveBeenLastCalledWith({ theme: 'auto' });
    });

    it('chooses the date position from a Top | Bottom group', async () => {
      const user = userEvent.setup();
      await render(ConfiguratorPageComponent, { providers: defaultProviders() });
      const group = screen.getByRole('radiogroup', { name: 'Date position' });

      expect(
        within(group)
          .getAllByRole('radio')
          .map((r) => r.textContent?.trim()),
      ).toEqual(['Top', 'Bottom']);
      const current = draft().settings.datePosition;
      await user.click(
        within(group).getByRole('radio', { name: current === 'top' ? 'Bottom' : 'Top' }),
      );

      expect(store.updateSettings).toHaveBeenLastCalledWith({
        datePosition: current === 'top' ? 'bottom' : 'top',
      });
    });

    it('exports showSeconds: true after the switch is turned on (data parity)', async () => {
      const user = userEvent.setup();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
      await render(ConfiguratorPageComponent, {
        providers: [
          { provide: AppService, useValue: appService },
          { provide: ThemeService, useValue: { isDark: signal(true), toggleTheme: vi.fn() } },
          {
            provide: MetadataService,
            useValue: { metadata: signal(DEFAULT_DASHBOARD_CONFIG.metadata) },
          },
          {
            provide: YamlLoaderService,
            useValue: {
              mountedPath: '/config/dashboard.yaml',
              mountedConfigResult: signal<MountedConfigResult>({
                status: 'valid',
                config: {
                  ...draft(),
                  settings: { ...draft().settings, showSeconds: false },
                },
              }),
              refreshMountedConfig: yamlLoader.refreshMountedConfig,
            },
          },
          { provide: LoggerService, useValue: logger },
          { provide: NotificationService, useValue: notifications },
          { provide: ConfigWriteService, useValue: configWrite },
          ConfiguratorStore,
          ConfigExportService,
        ],
      });

      await user.click(screen.getByRole('button', { name: 'Load mounted YAML' }));
      expect(screen.getByRole('switch', { name: 'Show seconds' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
      await user.click(screen.getByRole('switch', { name: 'Show seconds' }));
      expect(screen.getByRole('switch', { name: 'Show seconds' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await user.click(screen.getByRole('button', { name: 'Copy YAML' }));

      await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
      expect(writeText.mock.calls[0][0]).toContain('showSeconds: true');
    });
  });

  describe('layout control', () => {
    afterEach(() => {
      draft.set({ ...draft(), settings: { ...draft().settings, layout: 'horizontal' } });
    });

    it('opens the Settings section, before the theme, reflecting the draft layout', async () => {
      draft.set({ ...draft(), settings: { ...draft().settings, layout: 'vertical' } });
      await render(ConfiguratorPageComponent, { providers: defaultProviders() });

      const settings = within(document.getElementById('section-settings') as HTMLElement);
      const layout = settings.getByRole('group', { name: 'Layout' });

      expect(within(layout).getByRole('radio', { name: 'Vertical bar' })).toBeChecked();
      expect(
        layout.compareDocumentPosition(settings.getByRole('radiogroup', { name: 'Theme' })),
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('writes only the layout of the draft when a layout is chosen', async () => {
      const user = userEvent.setup();
      await render(ConfiguratorPageComponent, { providers: defaultProviders() });

      await user.click(screen.getByRole('radio', { name: 'Vertical bar' }));

      expect(store.updateSettings).toHaveBeenCalledExactlyOnceWith({ layout: 'vertical' });
    });

    it('exports layout: vertical after Vertical bar is chosen (data parity)', async () => {
      const user = userEvent.setup();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
      await render(ConfiguratorPageComponent, {
        providers: [
          { provide: AppService, useValue: appService },
          { provide: ThemeService, useValue: { isDark: signal(true), toggleTheme: vi.fn() } },
          {
            provide: MetadataService,
            useValue: { metadata: signal(DEFAULT_DASHBOARD_CONFIG.metadata) },
          },
          {
            provide: YamlLoaderService,
            useValue: {
              mountedPath: '/config/dashboard.yaml',
              mountedConfigResult: signal<MountedConfigResult>({
                status: 'valid',
                config: {
                  ...draft(),
                  settings: { ...draft().settings, layout: 'horizontal' },
                },
              }),
              refreshMountedConfig: yamlLoader.refreshMountedConfig,
            },
          },
          { provide: LoggerService, useValue: logger },
          { provide: NotificationService, useValue: notifications },
          { provide: ConfigWriteService, useValue: configWrite },
          ConfiguratorStore,
          ConfigExportService,
        ],
      });

      await user.click(screen.getByRole('button', { name: 'Load mounted YAML' }));
      expect(screen.getByRole('radio', { name: 'Horizontal bar' })).toBeChecked();
      await user.click(screen.getByRole('radio', { name: 'Vertical bar' }));
      expect(screen.getByRole('radio', { name: 'Vertical bar' })).toBeChecked();
      await user.click(screen.getByRole('button', { name: 'Copy YAML' }));

      await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
      expect(writeText.mock.calls[0][0]).toContain('layout: vertical');
    });
  });

  describe('theme and accessibility matrix', () => {
    const root = document.documentElement;
    const originalWidth = window.innerWidth;
    const resizeTo = (width: number) =>
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });

    afterEach(() => {
      root.classList.remove('dark');
      root.removeAttribute('data-theme');
      localStorage.clear();
      resizeTo(originalWidth);
    });

    it('toggles the dark class from the header and stores the choice as the dashboard does', async () => {
      const user = userEvent.setup();
      localStorage.setItem('dashboard-theme', 'dark');
      await render(ConfiguratorPageComponent, {
        providers: [
          ...defaultProviders().filter(({ provide }) => provide !== ThemeService),
          ThemeService,
          {
            provide: SettingsService,
            useValue: { settings: signal(DEFAULT_DASHBOARD_CONFIG.settings) },
          },
          { provide: LoggerService, useValue: logger },
          { provide: NotificationService, useValue: notifications },
        ],
      });
      expect(root).toHaveClass('dark');

      await user.click(screen.getByRole('button', { name: 'Toggle theme' }));

      expect(root).not.toHaveClass('dark');
      expect(root).toHaveAttribute('data-theme', 'light');
      expect(localStorage.getItem('dashboard-theme')).toBe('light');

      // The dashboard reads the same stored preference when it is displayed.
      root.removeAttribute('data-theme');
      const dashboardTheme = TestBed.runInInjectionContext(() => new ThemeService());
      expect(dashboardTheme.themeMode()).toBe('light');
      expect(root).toHaveAttribute('data-theme', 'light');
      expect(root).not.toHaveClass('dark');
    });

    it.each(
      (['dark', 'light'] as const).flatMap((theme) =>
        ([1440, 390] as const).flatMap((width) =>
          (['valid', 'invalid'] as const).map((state) => [theme, width, state] as const),
        ),
      ),
    )(
      'has no detectable AXE violations in the %s theme at %i px with a %s draft and an open editor',
      async (theme, width, state) => {
        const user = userEvent.setup();
        root.classList.toggle('dark', theme === 'dark');
        resizeTo(width);
        if (state === 'valid') validationErrors.set([]);
        const view = await render(ConfiguratorPageComponent, { providers: defaultProviders() });

        // An invalid row opens by itself; a valid one needs Edit.
        const edit = screen.getByRole('button', { name: 'Edit Plex' });
        if (edit.getAttribute('aria-expanded') === 'false') await user.click(edit);
        expect(screen.getByLabelText('Application ID for Plex')).toBeVisible();

        await expectNoAxeViolations(view.container);
      },
    );
  });
});
