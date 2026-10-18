import { DOCUMENT } from '@angular/common';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
  type Signal,
} from '@angular/core';

import {
  resolveTheme,
  THEME_SETTINGS,
  themeInfo,
  type ThemeId,
  type ThemeInfo,
  type ThemeSetting,
} from '../themes/theme.registry';

import { LoggerService } from './logger.service';
import { NotificationService } from './notification.service';
import { SettingsService } from './settings.service';

/**
 * Owns which theme the app shows and applies it as `<html data-theme="<id>">`, the only DOM write:
 * each theme's stylesheet (`styles/themes/<id>.css`) is selected by that attribute.
 *
 * Three layers, from the one that persists to the one that does not:
 * - `preference`: the device's stored choice if there is one, else `settings.theme` (may be `auto`);
 * - `committed`: the preference resolved to a theme (`auto` follows `prefers-color-scheme` live);
 * - `theme`: what is shown, the transient preview over `committed`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly settingsService = inject(SettingsService);
  private readonly document = inject(DOCUMENT);
  private readonly logger = inject(LoggerService);
  private readonly notifications = inject(NotificationService);

  private readonly STORAGE_KEY = 'dashboard-theme';
  private readonly LIGHT_SCHEME = '(prefers-color-scheme: light)';

  private readonly stored = signal<ThemeSetting | undefined>(this.readStored());
  private readonly previewed = signal<ThemeId | undefined>(undefined);
  private readonly systemPrefersLight = signal(false);

  /** What governs: the stored choice if present, else the configured `settings.theme`. */
  readonly preference: Signal<ThemeSetting> = computed(
    () => this.stored() ?? this.settingsService.settings().theme,
  );
  /** The preference resolved to a theme; follows the system while the preference is `auto`. */
  readonly committed: Signal<ThemeId> = computed(() =>
    resolveTheme(this.preference(), this.systemPrefersLight()),
  );
  /** The active theme: the preview while one is shown, else the committed one. */
  readonly theme: Signal<ThemeId> = computed(() => this.previewed() ?? this.committed());
  /** The registry entry of the active theme. */
  readonly info: Signal<ThemeInfo> = computed(() => themeInfo(this.theme()));

  constructor() {
    const mediaQuery = window.matchMedia(this.LIGHT_SCHEME);
    const onChange = (event: MediaQueryListEvent) => this.systemPrefersLight.set(event.matches);
    this.systemPrefersLight.set(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => mediaQuery.removeEventListener('change', onChange));

    effect(() => this.document.documentElement.setAttribute('data-theme', this.theme()));
  }

  /** Commits a registered theme: it becomes the stored preference (ending `auto` on this device). */
  select(id: ThemeId): void {
    this.previewed.set(undefined);
    this.stored.set(id);
    try {
      localStorage.setItem(this.STORAGE_KEY, id);
    } catch (error) {
      this.logger.warn('[ThemeService] Failed to save theme to localStorage', error);
      this.notifications.warning(
        'Unable to save your theme preference. Your selection will apply for this session.',
      );
    }
  }

  /** Shows a theme without committing it: never persisted, never notifies. */
  preview(id: ThemeId): void {
    this.previewed.set(id);
  }

  cancelPreview(): void {
    this.previewed.set(undefined);
  }

  /**
   * Forgets this device's stored choice so the configured `settings.theme` governs again. A no-op for
   * the storage when nothing is stored.
   */
  clearPreference(): void {
    this.previewed.set(undefined);
    if (this.stored() === undefined) return;

    this.stored.set(undefined);
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      this.logger.warn('[ThemeService] Failed to clear theme from localStorage', error);
      this.notifications.warning(
        'Unable to update your saved theme preference. The change will apply for this session.',
      );
    }
  }

  /**
   * The stored choice: a registered id, or `auto` (written by earlier versions, still meaning "as the
   * system prefers"). Any other value is ignored as if absent.
   */
  private readStored(): ThemeSetting | undefined {
    try {
      const value = localStorage.getItem(this.STORAGE_KEY);
      return THEME_SETTINGS.find((setting) => setting === value);
    } catch (error) {
      this.logger.warn('[ThemeService] Failed to read theme from localStorage', error);
      this.notifications.warning(
        'Unable to load your saved theme preference. Using the configured theme.',
      );
      return undefined;
    }
  }
}
