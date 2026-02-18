import {Injectable, inject} from '@angular/core';
import {signal, computed, Signal} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {Observable, fromEvent} from 'rxjs';
import {startWith, map} from 'rxjs/operators';

import {SettingsService} from './settings.service';

/**
 * Theme type options
 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * Theme state
 */
export interface ThemeState {
  mode: ThemeMode;
  current: 'light' | 'dark';
}

/**
 * Service for managing application theme (dark/light mode)
 * Integrates with TailwindCSS 4 for seamless theming
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly settingsService = inject(SettingsService);
  private readonly document = inject(DOCUMENT);

  private readonly STORAGE_KEY = 'dashboard-theme';

  // Reactive state with signals
  private readonly themeModeSignal = signal<ThemeMode>('auto');
  private readonly currentThemeSignal = signal<'light' | 'dark'>('light');

  /**
   * Observable streams for component consumption
   */
  readonly themeMode$: Observable<ThemeMode> = fromEvent<StorageEvent>(window, 'storage').pipe(
    startWith({ key: this.STORAGE_KEY } as StorageEvent),
    map(() => this.getStoredThemeMode() || 'auto'),
  );

  readonly isDark$: Observable<boolean> = this.themeMode$.pipe(
    map((mode) => this.isDarkMode(mode)),
  );

  // Signal-based API (preferred in Angular 21)
  readonly themeMode: Signal<ThemeMode> = this.themeModeSignal.asReadonly();
  readonly currentTheme: Signal<'light' | 'dark'> = this.currentThemeSignal.asReadonly();
  readonly isDark: Signal<boolean> = computed(() => this.currentThemeSignal() === 'dark');

  constructor() {
    this.initializeTheme();
    this.setupMediaQueryListener();
  }

  /**
   * Initialize theme on service creation
   */
  private initializeTheme(): void {
    const storedMode = this.getStoredThemeMode();
    this.themeModeSignal.set(storedMode);
    this.applyTheme(storedMode);
  }

  /**
   * Setup system preference listener for 'auto' mode
   */
  private setupMediaQueryListener(): void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e: MediaQueryListEvent) => {
      if (this.themeModeSignal() === 'auto') {
        this.currentThemeSignal.set(e.matches ? 'dark' : 'light');
        this.applyThemeClass();
      }
    };

    mediaQuery.addEventListener('change', handler);
  }

  /**
   * Set theme mode
   * @param mode - Theme mode to set
   */
  setThemeMode(mode: ThemeMode): void {
    this.themeModeSignal.set(mode);
    this.saveThemeMode(mode);
    this.applyTheme(mode);
  }

  /**
   * Toggle between light and dark mode
   * If in 'auto' mode, switches to 'dark' or 'light' explicitly
   */
  toggleTheme(): void {
    const currentMode = this.themeModeSignal();
    const currentTheme = this.currentThemeSignal();

    let newMode: ThemeMode;

    if (currentMode === 'auto') {
      // Switch from auto to explicit dark/light
      newMode = currentTheme === 'dark' ? 'light' : 'dark';
    } else {
      // Toggle between light and dark
      newMode = currentMode === 'dark' ? 'light' : 'dark';
    }

    this.setThemeMode(newMode);
  }

  /**
   * Get current theme mode
   * @returns Current theme mode
   */
  getThemeMode(): ThemeMode {
    return this.themeModeSignal();
  }

  /**
   * Get current active theme (resolved for 'auto' mode)
   * @returns 'light' or 'dark'
   */
  getCurrentTheme(): 'light' | 'dark' {
    return this.currentThemeSignal();
  }

  /**
   * Check if currently in dark mode
   * @returns true if dark mode
   */
  isDarkMode(mode?: ThemeMode): boolean {
    const activeMode = mode || this.themeModeSignal();

    if (activeMode === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    return activeMode === 'dark';
  }

  /**
   * Apply theme to document (Tailwind 4 compatible)
   * @param mode - Theme mode to apply
   */
  private applyTheme(mode: ThemeMode): void {
    const isDark = this.isDarkMode(mode);
    this.currentThemeSignal.set(isDark ? 'dark' : 'light');
    this.applyThemeClass();
  }

  /**
   * Apply theme class to HTML element
   * Tailwind 4 uses 'dark' class for dark mode
   */
  private applyThemeClass(): void {
    const htmlElement = this.document.documentElement;
    const isDark = this.currentThemeSignal() === 'dark';

    if (isDark) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }

    // Store preference in data attribute for potential CSS custom properties
    htmlElement.setAttribute('data-theme', this.currentThemeSignal());
  }

  /**
   * Save theme mode to localStorage
   * @param mode - Theme mode to save
   */
  private saveThemeMode(mode: ThemeMode): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, mode);
    } catch (error) {
      console.warn('[ThemeService] Failed to save theme to localStorage:', error);
    }
  }

  /**
   * Get stored theme mode from localStorage
   * @returns Theme mode or 'auto' if not set
   */
  private getStoredThemeMode(): ThemeMode {
    return this.settingsService.settingsSubject.value.theme;
  }

  /**
   * Reset theme to auto mode
   */
  resetTheme(): void {
    this.setThemeMode('auto');
  }

  /**
   * Get system preference
   * @returns System preference: 'light' or 'dark'
   */
  getSystemPreference(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /**
   * Watch for system theme changes
   * @param callback - Callback function
   * @returns Cleanup function
   */
  watchSystemTheme(callback: (theme: 'light' | 'dark') => void): () => void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e: MediaQueryListEvent) => {
      callback(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);

    // Return cleanup function
    return () => mediaQuery.removeEventListener('change', handler);
  }
}
