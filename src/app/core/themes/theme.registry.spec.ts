import {
  DEFAULT_THEME,
  THEME_IDS,
  THEME_SETTINGS,
  THEMES,
  ThemeId,
  resolveTheme,
} from './theme.registry';

describe('theme registry', () => {
  it('registers dark, light and catppuccin-mocha, in that order, displayed as Dark, Light and Catppuccin Mocha', () => {
    expect(THEMES.map((theme) => [theme.id, theme.name])).toEqual([
      ['dark', 'Dark'],
      ['light', 'Light'],
      ['catppuccin-mocha', 'Catppuccin Mocha'],
    ]);
  });

  it('describes Catppuccin Mocha as a dark theme: it uses the dark image slot', () => {
    const mocha = THEMES.find((theme) => theme.id === 'catppuccin-mocha');

    expect(mocha).toMatchObject({ description: 'Soothing pastel · dark', background: 'dark' });
    expect(mocha?.swatch).toEqual({
      bg: '#1E1E2E',
      card: '#45475A',
      accent: '#CBA6F7',
      text: '#CDD6F4',
    });
  });

  it('derives the ids from the registry, in order', () => {
    expect(THEME_IDS).toEqual(THEMES.map((theme) => theme.id));
  });

  it('offers auto first in the settings, then every registered id; auto is not a theme', () => {
    expect(THEME_SETTINGS).toEqual(['auto', ...THEME_IDS]);
    expect(THEME_IDS).not.toContain('auto');
  });

  it('defaults to a registered theme: dark', () => {
    expect(DEFAULT_THEME).toBe('dark');
    expect(THEME_IDS).toContain(DEFAULT_THEME);
  });

  it('gives every theme the data the picker draws and the background slot it uses', () => {
    for (const theme of THEMES) {
      expect(theme.name).not.toBe('');
      expect(theme.description).not.toBe('');
      expect(['light', 'dark']).toContain(theme.background);
      expect(Object.keys(theme.swatch).sort()).toEqual(['accent', 'bg', 'card', 'text']);
    }
  });

  describe('resolveTheme', () => {
    it('resolves auto to light when the system prefers light', () => {
      expect(resolveTheme('auto', true)).toBe('light');
    });

    it('resolves auto to dark when the system does not prefer light', () => {
      expect(resolveTheme('auto', false)).toBe('dark');
    });

    it.each(THEME_IDS.flatMap((id) => [[id, true] as const, [id, false] as const]))(
      'resolves the theme id %s to itself regardless of the system (prefers light: %s)',
      (id: ThemeId, systemPrefersLight: boolean) => {
        expect(resolveTheme(id, systemPrefersLight)).toBe(id);
      },
    );
  });
});
