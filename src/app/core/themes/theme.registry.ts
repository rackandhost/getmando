/**
 * The only list of themes. Every other list (configuration schema, picker, configurator's Default
 * theme control, contrast audit) is derived from `THEMES`.
 *
 * A theme is a stylesheet in `src/styles/themes/<id>.css` selected by `<html data-theme="<id>">`.
 */
export interface ThemeInfo {
  id: ThemeId;
  name: string;
  description: string;
  /** Which background image slot the theme uses: `lightBackgroundImage` or `darkBackgroundImage`. */
  background: 'light' | 'dark';
  /** Decorative four-colour preview the picker draws for themes that are not applied. */
  swatch: { bg: string; card: string; accent: string; text: string };
}

/** Order of the picker. */
export const THEMES = [
  {
    id: 'dark',
    name: 'Dark',
    description: 'Mando default',
    background: 'dark',
    swatch: { bg: '#0D0F11', card: '#262B32', accent: '#F0B04A', text: '#EDEBE6' },
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Mando default',
    background: 'light',
    swatch: { bg: '#F3F1EC', card: '#FFFFFF', accent: '#9A5B00', text: '#383E44' },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    description: 'Soothing pastel · dark',
    background: 'dark',
    swatch: { bg: '#1E1E2E', card: '#45475A', accent: '#CBA6F7', text: '#CDD6F4' },
  },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const THEME_IDS = THEMES.map((theme) => theme.id) as [ThemeId, ...ThemeId[]];

export const DEFAULT_THEME: ThemeId = 'dark';

/**
 * `auto` is not a theme (no stylesheet, no swatch, never in the picker): it is a value of
 * `settings.theme` that resolves to a theme by the operating system's colour scheme.
 */
export const THEME_SETTINGS = ['auto', ...THEME_IDS] as const;

export type ThemeSetting = (typeof THEME_SETTINGS)[number];

export function resolveTheme(setting: ThemeSetting, systemPrefersLight: boolean): ThemeId {
  if (setting === 'auto') return systemPrefersLight ? 'light' : 'dark';
  return setting;
}
