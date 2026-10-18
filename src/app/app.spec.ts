import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { App } from './app';
import { DEFAULT_DASHBOARD_CONFIG, DashboardSettings } from './core/models/dashboard.models';
import { AppService } from './core/services/app.service';
import { MetadataService } from './core/services/metadata.service';
import { SettingsService } from './core/services/settings.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-stub-page',
  template: '<main><button type="button">Stub action</button></main>',
})
class StubPageComponent {}

describe('App', () => {
  const settingsState = signal<DashboardSettings>(DEFAULT_DASHBOARD_CONFIG.settings);
  let originalMatchMediaDescriptor: PropertyDescriptor | undefined;

  /** The real ThemeService runs over the configured settings and a system that does not prefer light. */
  const shellProviders = [
    provideRouter([]),
    { provide: AppService, useValue: { appVersion: '1.1.0-test' } },
    { provide: MetadataService, useValue: { metadata: signal(DEFAULT_DASHBOARD_CONFIG.metadata) } },
    {
      provide: SettingsService,
      useValue: { settings: settingsState, layout: computed(() => settingsState().layout) },
    },
  ];

  const expectBackgroundImageToBe = (expectedUrl: string) => {
    const escapedUrl = expectedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const bgLayer = document.getElementById('app-background');

    expect(bgLayer).not.toBeNull();
    expect(bgLayer!.style.backgroundImage).toMatch(
      new RegExp(`^url\\(["']?${escapedUrl}["']?\\)$`),
    );
    expect(bgLayer!.style.backgroundImage.match(/url\(/g)).toHaveLength(1);
  };

  beforeEach(() => {
    originalMatchMediaDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    localStorage.clear();
    let bgLayer = document.getElementById('app-background');
    if (!bgLayer) {
      bgLayer = document.createElement('div');
      bgLayer.id = 'app-background';
      document.body.appendChild(bgLayer);
    }
    bgLayer.style.backgroundImage = '';
    settingsState.set(DEFAULT_DASHBOARD_CONFIG.settings);
  });

  afterEach(() => {
    if (originalMatchMediaDescriptor) {
      Object.defineProperty(window, 'matchMedia', originalMatchMediaDescriptor);
    } else {
      Reflect.deleteProperty(window, 'matchMedia');
    }
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('provides a router shell and one global toast host', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: shellProviders,
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('router-outlet')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('app-dashboard')).toHaveLength(0);
    expect(fixture.nativeElement.querySelectorAll('app-toast')).toHaveLength(1);
  });

  it('renders the footer once after the routed content and leaves the header to each view', async () => {
    await render(App, {
      providers: [
        ...shellProviders.slice(1),
        provideRouter([{ path: '', component: StubPageComponent }]),
      ],
    });

    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Powered by Mando');
    expect(
      (await screen.findByRole('main')).compareDocumentPosition(screen.getByRole('contentinfo')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps the routed content before the footer in tab order', async () => {
    const user = userEvent.setup();
    await render(App, {
      providers: [
        ...shellProviders.slice(1),
        provideRouter([{ path: '', component: StubPageComponent }]),
      ],
    });

    await user.tab();
    expect(screen.getByRole('button', { name: 'Stub action' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Mando' })).toHaveFocus();
  });

  it.each([
    ['dark', '/img/custom-dark.jpg'],
    ['light', '/img/custom-light.jpg'],
    ['catppuccin-mocha', '/img/custom-dark.jpg'],
  ] as const)('applies the slot of the %s theme: %s', async (theme, expectedUrl) => {
    settingsState.set({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      theme,
      darkBackgroundImage: 'custom-dark.jpg',
      lightBackgroundImage: 'custom-light.jpg',
    });

    await render(App, { providers: shellProviders });

    expectBackgroundImageToBe(expectedUrl);
  });

  it('should not prefix https background image URLs with /img/', async () => {
    settingsState.set({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      theme: 'dark',
      darkBackgroundImage: 'https://cdn.example.com/dark.jpg',
      lightBackgroundImage: 'http://cdn.example.com/light.jpg',
    });

    await render(App, { providers: shellProviders });

    expectBackgroundImageToBe('https://cdn.example.com/dark.jpg');
    expect(document.getElementById('app-background')!.style.backgroundImage).not.toContain(
      '/img/https://cdn.example.com/dark.jpg',
    );
  });

  it('should not prefix http background image URLs with /img/', async () => {
    settingsState.set({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      theme: 'light',
      darkBackgroundImage: 'https://cdn.example.com/dark.jpg',
      lightBackgroundImage: 'http://cdn.example.com/light.jpg',
    });

    await render(App, { providers: shellProviders });

    expectBackgroundImageToBe('http://cdn.example.com/light.jpg');
    expect(document.getElementById('app-background')!.style.backgroundImage).not.toContain(
      '/img/http://cdn.example.com/light.jpg',
    );
  });

  it('updates the background image when the theme is selected after render', async () => {
    settingsState.set({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      theme: 'dark',
      darkBackgroundImage: 'custom-dark.jpg',
      lightBackgroundImage: 'custom-light.jpg',
    });
    const view = await render(App, { providers: shellProviders });
    expectBackgroundImageToBe('/img/custom-dark.jpg');

    TestBed.inject(ThemeService).select('light');
    await view.fixture.whenStable();

    expectBackgroundImageToBe('/img/custom-light.jpg');
  });

  it('follows a theme preview and goes back to the committed theme when it is cancelled', async () => {
    settingsState.set({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      theme: 'dark',
      darkBackgroundImage: 'custom-dark.jpg',
      lightBackgroundImage: 'custom-light.jpg',
    });
    const view = await render(App, { providers: shellProviders });
    const themes = TestBed.inject(ThemeService);

    themes.preview('light');
    await view.fixture.whenStable();
    expectBackgroundImageToBe('/img/custom-light.jpg');

    themes.cancelPreview();
    await view.fixture.whenStable();
    expectBackgroundImageToBe('/img/custom-dark.jpg');
    expect(localStorage.getItem('dashboard-theme')).toBeNull();
  });

  it('updates the background image when settings change after render', async () => {
    settingsState.set({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      theme: 'dark',
      darkBackgroundImage: 'initial-dark.jpg',
      lightBackgroundImage: 'initial-light.jpg',
    });
    const view = await render(App, { providers: shellProviders });
    expectBackgroundImageToBe('/img/initial-dark.jpg');

    settingsState.set({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      theme: 'dark',
      darkBackgroundImage: 'updated-dark.jpg',
      lightBackgroundImage: 'updated-light.jpg',
    });
    await view.fixture.whenStable();

    expectBackgroundImageToBe('/img/updated-dark.jpg');
  });
});
