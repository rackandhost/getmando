import { Component, signal } from '@angular/core';
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
  const currentTheme = signal<'light' | 'dark'>('dark');

  const shellProviders = [
    provideRouter([]),
    { provide: AppService, useValue: { appVersion: '1.1.0-test' } },
    { provide: MetadataService, useValue: { metadata: signal(DEFAULT_DASHBOARD_CONFIG.metadata) } },
    { provide: SettingsService, useValue: { settings: settingsState } },
    {
      provide: ThemeService,
      useValue: {
        currentTheme,
        isDark: () => currentTheme() === 'dark',
        isDarkMode: () => currentTheme() === 'dark',
        toggleTheme: vi.fn(),
      },
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
    let bgLayer = document.getElementById('app-background');
    if (!bgLayer) {
      bgLayer = document.createElement('div');
      bgLayer.id = 'app-background';
      document.body.appendChild(bgLayer);
    }
    bgLayer.style.backgroundImage = '';
    settingsState.set(DEFAULT_DASHBOARD_CONFIG.settings);
    currentTheme.set('dark');
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

  it('renders the shared header and footer once around the routed content', async () => {
    await render(App, { providers: shellProviders });

    expect(screen.getByRole('banner')).toHaveTextContent('Mando');
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Powered by Mando');
  });

  it('keeps the header before the routed content in tab order', async () => {
    const user = userEvent.setup();
    await render(App, {
      providers: [
        ...shellProviders.slice(1),
        provideRouter([{ path: '', component: StubPageComponent }]),
      ],
    });

    await user.tab();
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Stub action' })).toHaveFocus();
  });

  it('applies the background image that matches the current theme', async () => {
    settingsState.set({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      darkBackgroundImage: 'custom-dark.jpg',
      lightBackgroundImage: 'custom-light.jpg',
    });
    currentTheme.set('dark');

    await render(App, { providers: shellProviders });

    expectBackgroundImageToBe('/img/custom-dark.jpg');
  });

  it('applies the light background image when light theme is active', async () => {
    settingsState.set({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      darkBackgroundImage: 'custom-dark.jpg',
      lightBackgroundImage: 'custom-light.jpg',
    });
    currentTheme.set('light');

    await render(App, { providers: shellProviders });

    expectBackgroundImageToBe('/img/custom-light.jpg');
  });

  it('should not prefix https background image URLs with /img/', async () => {
    settingsState.set({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      darkBackgroundImage: 'https://cdn.example.com/dark.jpg',
      lightBackgroundImage: 'http://cdn.example.com/light.jpg',
    });
    currentTheme.set('dark');

    await render(App, { providers: shellProviders });

    expectBackgroundImageToBe('https://cdn.example.com/dark.jpg');
    expect(document.getElementById('app-background')!.style.backgroundImage).not.toContain(
      '/img/https://cdn.example.com/dark.jpg',
    );
  });

  it('should not prefix http background image URLs with /img/', async () => {
    settingsState.set({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      darkBackgroundImage: 'https://cdn.example.com/dark.jpg',
      lightBackgroundImage: 'http://cdn.example.com/light.jpg',
    });
    currentTheme.set('light');

    await render(App, { providers: shellProviders });

    expectBackgroundImageToBe('http://cdn.example.com/light.jpg');
    expect(document.getElementById('app-background')!.style.backgroundImage).not.toContain(
      '/img/http://cdn.example.com/light.jpg',
    );
  });

  it('updates the background image when the theme changes after render', async () => {
    settingsState.set({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      darkBackgroundImage: 'custom-dark.jpg',
      lightBackgroundImage: 'custom-light.jpg',
    });
    currentTheme.set('dark');

    const view = await render(App, { providers: shellProviders });

    expectBackgroundImageToBe('/img/custom-dark.jpg');

    currentTheme.set('light');
    await view.fixture.whenStable();

    expectBackgroundImageToBe('/img/custom-light.jpg');
  });

  it('updates the background image when settings change after render', async () => {
    settingsState.set({
      ...DEFAULT_DASHBOARD_CONFIG.settings,
      darkBackgroundImage: 'initial-dark.jpg',
      lightBackgroundImage: 'initial-light.jpg',
    });
    currentTheme.set('dark');

    const view = await render(App, { providers: shellProviders });

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
