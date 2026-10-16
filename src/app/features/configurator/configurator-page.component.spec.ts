import { signal, type WritableSignal } from '@angular/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Observable, of } from 'rxjs';

import { DashboardConfig, DEFAULT_DASHBOARD_CONFIG } from '../../core/models/dashboard.models';
import { AppService } from '../../core/services/app.service';
import { ConfigExportService } from '../../core/services/config-export.service';
import { ConfigWriteService } from '../../core/services/config-write.service';
import { LoggerService } from '../../core/services/logger.service';
import { NotificationService } from '../../core/services/notification.service';
import { YamlCodecService } from '../../core/services/yaml-codec.service';
import { MetadataService } from '../../core/services/metadata.service';
import { ThemeService } from '../../core/services/theme.service';
import { MountedConfigResult, YamlLoaderService } from '../../core/services/yaml-loader.service';
import { expectNoAxeViolations } from '../../../testing/a11y';
import { ScrollStateService, type ChromeProbe } from '../../core/scroll/scroll-state.service';
import type { ChromeMode } from '../../core/scroll/scroll-state';
import { METRICS_SOURCE, type MetricsSource } from '../../core/scroll/metrics-source';
import { ConfiguratorPageComponent } from './configurator-page.component';
import { ConfiguratorStore } from './configurator.store';

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
  };
  const appService = { initializeConfig: vi.fn() };
  const yamlLoader = {
    refreshMountedConfig: vi.fn<() => Observable<MountedConfigResult>>(),
  };

  const store = {
    draft,
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
    yamlLoader.refreshMountedConfig.mockReturnValue(of({ status: 'unavailable', message: 'n/a' }));
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
    await user.click(screen.getByLabelText('Show date'));
    await user.click(screen.getByLabelText('youtube'));

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
      '#field-applications-0-icon-value',
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
    ).toHaveAttribute('href', '#field-settings-itemsPerRow');
  });

  it('renders labeled settings fields and associates an actionable error summary with invalid fields', async () => {
    await render(ConfiguratorPageComponent, {
      providers: defaultProviders(),
    });

    expect(screen.getByRole('heading', { name: 'Configuration editor' })).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard title')).toHaveValue('Mando');
    expect(screen.getByLabelText('Theme')).toHaveValue('dark');
    expect(screen.getByRole('alert')).toHaveTextContent("Category 'missing' does not exist.");
    expect(screen.getByLabelText('Application category for Plex')).toHaveAttribute(
      'aria-describedby',
      'error-applications-0-category',
    );
    expect(
      screen.getByRole('link', { name: "Category 'missing' does not exist." }),
    ).toHaveAttribute('href', '#field-applications-0-category');
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
          const section = document.getElementById(link.getAttribute('href')?.slice(1) ?? '');
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
});
