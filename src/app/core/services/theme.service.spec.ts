import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DashboardSettings, DEFAULT_DASHBOARD_CONFIG } from '../models/dashboard.models';

import { SettingsService } from './settings.service';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let settings: ReturnType<typeof signal<DashboardSettings>>;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    settings = signal(DEFAULT_DASHBOARD_CONFIG.settings);

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
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
});
