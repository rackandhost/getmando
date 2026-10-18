import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DashboardSettings, DEFAULT_DASHBOARD_CONFIG } from '../models/dashboard.models';
import type { ThemeSetting } from '../themes/theme.registry';

import { LoggerService } from './logger.service';
import { NotificationService } from './notification.service';
import { SettingsService } from './settings.service';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  const root = document.documentElement;
  const logger = { warn: vi.fn() };
  const notifications = { warning: vi.fn() };
  let settings: WritableSignal<DashboardSettings>;
  let mediaQuery: { matches: boolean } & Record<string, unknown>;
  let systemThemeChange: ((event: MediaQueryListEvent) => void) | undefined;
  let originalMatchMediaDescriptor: PropertyDescriptor | undefined;

  /** The operating system's colour scheme as the `(prefers-color-scheme: light)` query reports it. */
  const setSystemPrefersLight = (matches: boolean) => {
    mediaQuery.matches = matches;
  };
  /** The operating system changes its scheme while the app is open. */
  const changeSystem = (matches: boolean) => {
    systemThemeChange?.({ matches } as MediaQueryListEvent);
    TestBed.flushEffects();
  };
  const configure = (theme: ThemeSetting) =>
    settings.set({ ...DEFAULT_DASHBOARD_CONFIG.settings, theme });
  const create = () => {
    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();
    return service;
  };

  afterEach(() => {
    if (originalMatchMediaDescriptor) {
      Object.defineProperty(window, 'matchMedia', originalMatchMediaDescriptor);
    } else {
      Reflect.deleteProperty(window, 'matchMedia');
    }
    root.removeAttribute('data-theme');
    root.removeAttribute('class');
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    originalMatchMediaDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    localStorage.clear();
    root.removeAttribute('class');
    root.removeAttribute('data-theme');
    settings = signal(DEFAULT_DASHBOARD_CONFIG.settings);

    mediaQuery = {
      matches: false,
      media: '(prefers-color-scheme: light)',
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
        { provide: SettingsService, useValue: { settings: settings.asReadonly() } },
        { provide: LoggerService, useValue: logger },
        { provide: NotificationService, useValue: notifications },
      ],
    });
  });

  describe('which theme governs', () => {
    it('applies the configured theme when nothing is stored', () => {
      configure('light');
      const service = create();

      expect(service.preference()).toBe('light');
      expect(service.committed()).toBe('light');
      expect(service.theme()).toBe('light');
      expect(root.dataset['theme']).toBe('light');
    });

    it('lets a stored choice beat the configured theme', () => {
      localStorage.setItem('dashboard-theme', 'light');
      configure('dark');
      const service = create();

      expect(service.preference()).toBe('light');
      expect(service.committed()).toBe('light');
      expect(service.theme()).toBe('light');
      expect(root.dataset['theme']).toBe('light');
    });

    it.each([
      [true, 'light'],
      [false, 'dark'],
    ] as const)(
      'resolves a configured auto by the system (prefers light: %s) and keeps it as auto',
      (prefersLight, expected) => {
        setSystemPrefersLight(prefersLight);
        configure('auto');
        const service = create();

        expect(service.preference()).toBe('auto');
        expect(service.committed()).toBe(expected);
        expect(root.dataset['theme']).toBe(expected);
      },
    );

    it('follows a system change live while the preference is auto', () => {
      setSystemPrefersLight(true);
      configure('auto');
      const service = create();

      changeSystem(false);
      expect(service.theme()).toBe('dark');
      expect(root.dataset['theme']).toBe('dark');

      changeSystem(true);
      expect(service.theme()).toBe('light');
      expect(root.dataset['theme']).toBe('light');
    });

    it('honours a stored auto, written by earlier versions, like a configured one', () => {
      localStorage.setItem('dashboard-theme', 'auto');
      setSystemPrefersLight(false);
      configure('light');
      const service = create();

      expect(service.preference()).toBe('auto');
      expect(service.theme()).toBe('dark');

      changeSystem(true);
      expect(service.theme()).toBe('light');
    });

    it('does not follow the system while a theme is configured or stored', () => {
      localStorage.setItem('dashboard-theme', 'dark');
      setSystemPrefersLight(false);
      const service = create();

      changeSystem(true);

      expect(service.theme()).toBe('dark');
    });

    it('ignores a stored value that is not a registered theme, without logging or warning', () => {
      localStorage.setItem('dashboard-theme', 'banana');
      configure('light');
      const service = create();

      expect(service.preference()).toBe('light');
      expect(service.theme()).toBe('light');
      expect(logger.warn).not.toHaveBeenCalled();
      expect(notifications.warning).not.toHaveBeenCalled();
    });

    it('applies a configuration that arrives late when nothing is stored', () => {
      const service = create();

      configure('light');
      TestBed.flushEffects();

      expect(service.theme()).toBe('light');
      expect(root.dataset['theme']).toBe('light');
    });

    it('does not let a late configuration override a stored choice', () => {
      localStorage.setItem('dashboard-theme', 'light');
      const service = create();

      configure('dark');
      TestBed.flushEffects();

      expect(service.theme()).toBe('light');
      expect(root.dataset['theme']).toBe('light');
    });

    it('gives the registry entry of the active theme: its name and its background slot', () => {
      const service = create();

      service.select('light');
      expect(service.info()).toMatchObject({ id: 'light', name: 'Light', background: 'light' });

      service.select('dark');
      expect(service.info()).toMatchObject({ id: 'dark', name: 'Dark', background: 'dark' });
    });
  });

  describe('select', () => {
    it('commits and persists the theme, and applies it', () => {
      const service = create();

      service.select('light');
      TestBed.flushEffects();

      expect(service.preference()).toBe('light');
      expect(service.committed()).toBe('light');
      expect(service.theme()).toBe('light');
      expect(localStorage.getItem('dashboard-theme')).toBe('light');
      expect(root.dataset['theme']).toBe('light');
      expect(logger.warn).not.toHaveBeenCalled();
      expect(notifications.warning).not.toHaveBeenCalled();
    });

    it('ends auto on this device: a later system change does not move the theme', () => {
      setSystemPrefersLight(true);
      configure('auto');
      const service = create();

      service.select('dark');
      changeSystem(false);
      changeSystem(true);

      expect(service.preference()).toBe('dark');
      expect(service.theme()).toBe('dark');
      expect(localStorage.getItem('dashboard-theme')).toBe('dark');
    });

    it('clears a preview', () => {
      const service = create();

      service.preview('light');
      service.select('dark');
      TestBed.flushEffects();

      expect(service.theme()).toBe('dark');
      service.cancelPreview();
      expect(service.theme()).toBe('dark');
    });

    it('keeps applying the theme, logs and warns once when persistence fails', () => {
      const service = create();
      const failure = new DOMException('Quota exceeded', 'QuotaExceededError');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw failure;
      });

      service.select('light');
      TestBed.flushEffects();

      expect(service.theme()).toBe('light');
      expect(root.dataset['theme']).toBe('light');
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        '[ThemeService] Failed to save theme to localStorage',
        expect.objectContaining({ name: 'QuotaExceededError' }),
      );
      expect(notifications.warning).toHaveBeenCalledOnce();
      expect(notifications.warning).toHaveBeenCalledWith(
        'Unable to save your theme preference. Your selection will apply for this session.',
      );
      expect(notifications.warning.mock.calls[0][0]).not.toContain('Quota exceeded');
    });
  });

  describe('preview', () => {
    it('shows the theme without committing, persisting or notifying', () => {
      configure('dark');
      const service = create();

      service.preview('light');
      TestBed.flushEffects();

      expect(service.theme()).toBe('light');
      expect(service.info().background).toBe('light');
      expect(service.committed()).toBe('dark');
      expect(service.preference()).toBe('dark');
      expect(root.dataset['theme']).toBe('light');
      expect(localStorage.getItem('dashboard-theme')).toBeNull();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(notifications.warning).not.toHaveBeenCalled();
    });

    it('is restored by cancelPreview, as the committed theme', () => {
      configure('dark');
      const service = create();

      service.preview('light');
      service.cancelPreview();
      TestBed.flushEffects();

      expect(service.theme()).toBe('dark');
      expect(root.dataset['theme']).toBe('dark');
      expect(localStorage.getItem('dashboard-theme')).toBeNull();
    });

    it('shows a previewed theme over a committed one that follows the system, then restores it', () => {
      setSystemPrefersLight(true);
      configure('auto');
      const service = create();

      service.preview('dark');
      expect(service.theme()).toBe('dark');
      expect(service.committed()).toBe('light');

      service.cancelPreview();
      expect(service.theme()).toBe('light');
    });
  });

  describe('clearPreference', () => {
    it('deletes the stored choice so the configured theme governs again', () => {
      localStorage.setItem('dashboard-theme', 'light');
      configure('dark');
      const service = create();

      service.clearPreference();
      TestBed.flushEffects();

      expect(localStorage.getItem('dashboard-theme')).toBeNull();
      expect(service.preference()).toBe('dark');
      expect(service.committed()).toBe('dark');
      expect(root.dataset['theme']).toBe('dark');
    });

    it('lets a configured auto resolve by the system and follow it live afterwards', () => {
      localStorage.setItem('dashboard-theme', 'light');
      setSystemPrefersLight(false);
      configure('auto');
      const service = create();

      service.clearPreference();
      expect(service.preference()).toBe('auto');
      expect(service.theme()).toBe('dark');

      changeSystem(true);
      expect(service.theme()).toBe('light');
    });

    it('clears a preview', () => {
      configure('dark');
      const service = create();

      service.preview('light');
      service.clearPreference();

      expect(service.theme()).toBe('dark');
    });

    it('does nothing to the storage when nothing is stored', () => {
      configure('dark');
      const service = create();
      const removeItem = vi.spyOn(Storage.prototype, 'removeItem');

      service.clearPreference();

      expect(removeItem).not.toHaveBeenCalled();
      expect(service.theme()).toBe('dark');
    });

    it('lets a later configuration arrive as it does on a fresh device', () => {
      localStorage.setItem('dashboard-theme', 'light');
      const service = create();

      service.clearPreference();
      configure('dark');
      TestBed.flushEffects();

      expect(service.theme()).toBe('dark');
    });

    it('keeps the fallback, logs and warns once when the storage cannot be cleared', () => {
      localStorage.setItem('dashboard-theme', 'light');
      configure('dark');
      const service = create();
      const failure = new DOMException('Access denied', 'SecurityError');
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw failure;
      });

      service.clearPreference();
      TestBed.flushEffects();

      expect(service.theme()).toBe('dark');
      expect(root.dataset['theme']).toBe('dark');
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        '[ThemeService] Failed to clear theme from localStorage',
        expect.objectContaining({ name: 'SecurityError' }),
      );
      expect(notifications.warning).toHaveBeenCalledOnce();
      expect(notifications.warning.mock.calls[0][0]).not.toContain('Access denied');
    });
  });

  describe('storage', () => {
    it('falls back to the configured theme, logs and warns once when the storage cannot be read', () => {
      configure('light');
      // jsdom's localStorage instance silently ignores direct property spies; spy on the prototype instead.
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });

      const service = create();

      expect(service.theme()).toBe('light');
      expect(root.dataset['theme']).toBe('light');
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        '[ThemeService] Failed to read theme from localStorage',
        expect.objectContaining({ name: 'SecurityError' }),
      );
      expect(notifications.warning).toHaveBeenCalledOnce();
      expect(notifications.warning).toHaveBeenCalledWith(
        'Unable to load your saved theme preference. Using the configured theme.',
      );
      expect(notifications.warning.mock.calls[0][0]).not.toContain('Access denied');
    });
  });

  describe('the document', () => {
    it('writes data-theme and nothing else on the root element', () => {
      root.className = 'untouched';
      const service = create();

      service.select('light');
      service.preview('dark');
      TestBed.flushEffects();

      expect(root.dataset['theme']).toBe('dark');
      expect(root.className).toBe('untouched');
      expect(root.getAttributeNames().sort()).toEqual(['class', 'data-theme']);
    });

    it('stops listening to the system when the service is destroyed', () => {
      create();
      const listener = systemThemeChange;

      TestBed.resetTestingModule();

      expect(mediaQuery['removeEventListener']).toHaveBeenCalledWith('change', listener);
    });
  });
});
