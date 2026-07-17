import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DashboardSettings, DEFAULT_DASHBOARD_CONFIG } from '../models/dashboard.models';

import { SettingsService } from './settings.service';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let settings: ReturnType<typeof signal<DashboardSettings>>;
  let mediaQuery: MediaQueryList;
  let systemThemeChange: ((event: MediaQueryListEvent) => void) | undefined;
  let originalMatchMediaDescriptor: PropertyDescriptor | undefined;

  afterEach(() => {
    if (originalMatchMediaDescriptor) {
      Object.defineProperty(window, 'matchMedia', originalMatchMediaDescriptor);
    } else {
      Reflect.deleteProperty(window, 'matchMedia');
    }
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    originalMatchMediaDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-theme');
    settings = signal(DEFAULT_DASHBOARD_CONFIG.settings);

    mediaQuery = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn((_type, listener) => {
        systemThemeChange = listener as (event: MediaQueryListEvent) => void;
      }),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => mediaQuery),
    });

    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        {
          provide: SettingsService,
          useValue: { settings: settings.asReadonly() },
        },
      ],
    });
  });

  it('falls back to configured settings when localStorage cannot be read', () => {
    settings.set({ ...DEFAULT_DASHBOARD_CONFIG.settings, theme: 'dark' });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();

    expect(service.getThemeMode()).toBe('dark');
    expect(service.getCurrentTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      '[ThemeService] Failed to read theme from localStorage:',
      expect.objectContaining({ name: 'SecurityError' }),
    );
  });

  it('reconciles a delayed configured theme when no preference is stored', () => {
    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();

    settings.set({ ...DEFAULT_DASHBOARD_CONFIG.settings, theme: 'dark' });
    TestBed.flushEffects();

    expect(service.getThemeMode()).toBe('dark');
    expect(service.getCurrentTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('keeps a stored preference when configured settings arrive later', () => {
    localStorage.setItem('dashboard-theme', 'light');
    const service = TestBed.inject(ThemeService);

    settings.set({ ...DEFAULT_DASHBOARD_CONFIG.settings, theme: 'dark' });
    TestBed.flushEffects();

    expect(service.getThemeMode()).toBe('light');
    expect(service.getCurrentTheme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('sets, persists, and exposes explicit theme state', () => {
    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();

    service.setThemeMode('dark');

    expect(service.themeMode()).toBe('dark');
    expect(service.currentTheme()).toBe('dark');
    expect(service.isDark()).toBe(true);
    expect(service.getThemeMode()).toBe('dark');
    expect(service.getCurrentTheme()).toBe('dark');
    expect(service.isDarkMode()).toBe(true);
    expect(localStorage.getItem('dashboard-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggles explicit and resolved auto themes', () => {
    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();

    service.setThemeMode('light');
    service.toggleTheme();
    expect(service.getThemeMode()).toBe('dark');

    service.resetTheme();
    service.toggleTheme();
    expect(service.getThemeMode()).toBe('dark');
  });

  it('resolves auto mode and reacts to system changes only while auto is active', () => {
    Object.defineProperty(mediaQuery, 'matches', { configurable: true, value: true });
    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();

    service.resetTheme();
    expect(service.getSystemPreference()).toBe('dark');
    expect(service.getCurrentTheme()).toBe('dark');

    systemThemeChange?.({ matches: false } as MediaQueryListEvent);
    expect(service.getCurrentTheme()).toBe('light');

    service.setThemeMode('dark');
    systemThemeChange?.({ matches: false } as MediaQueryListEvent);
    expect(service.getCurrentTheme()).toBe('dark');
  });

  it('keeps applying a theme when persistence fails', () => {
    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();
    const failure = new DOMException('Quota exceeded', 'QuotaExceededError');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw failure;
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    service.setThemeMode('dark');

    expect(service.getCurrentTheme()).toBe('dark');
    expect(warn).toHaveBeenCalledWith(
      '[ThemeService] Failed to save theme to localStorage:',
      failure,
    );
  });

  it('watches system changes and removes the exact listener during cleanup', () => {
    const service = TestBed.inject(ThemeService);
    const callback = vi.fn();
    const cleanup = service.watchSystemTheme(callback);
    const listener = systemThemeChange;

    listener?.({ matches: true } as MediaQueryListEvent);
    cleanup();

    expect(callback).toHaveBeenCalledWith('dark');
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', listener);
  });
});
