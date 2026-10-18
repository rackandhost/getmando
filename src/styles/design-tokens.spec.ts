import { promises as fs } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { DEFAULT_THEME, THEME_IDS, THEMES, type ThemeId } from '../app/core/themes/theme.registry';
import { contrastRatio, parseColor } from '../testing/contrast';
import {
  auditTokens,
  measureTokens,
  parseThemeTokens,
  type Measurement,
  type ThemeStylesheet,
} from '../testing/token-audit';

let tokensCss: string;
let surfacesCss: string;
let stylesCss: string;
/** The stylesheet of every registered theme, read from `styles/themes/<id>.css`. */
let themes: ThemeStylesheet[];

beforeAll(async () => {
  const read = (file: string) => fs.readFile(path.join(process.cwd(), 'src', file), 'utf8');
  [tokensCss, surfacesCss, stylesCss] = await Promise.all([
    read('styles/tokens.css'),
    read('styles/surfaces.css'),
    read('styles.css'),
  ]);
  themes = await Promise.all(
    THEME_IDS.map(async (id) => ({
      id,
      css: await read(`styles/themes/${id}.css`).catch(() => ''),
    })),
  );
});

const tokensOf = (id: ThemeId) =>
  parseThemeTokens((themes.find((theme) => theme.id === id) as ThemeStylesheet).css, id);

/** Appends later declarations, which win the cascade, to the named themes to simulate a changed token. */
function withOverrides(overrides: Partial<Record<ThemeId, string>>): ThemeStylesheet[] {
  return themes.map(({ id, css }) => ({
    id,
    css: `${css}\n:root[data-theme='${id}'] { ${overrides[id] ?? ''} }\n`,
  }));
}

/** Points `property` of one recipe at another token, e.g. the floor a recipe declares. */
function redirect(css: string, recipe: string, property: string, token: string): string {
  const declaration = new RegExp(`(@utility ${recipe}\\s*\\{[^]*?${property}:\\s*)var\\([^)]*\\)`);
  const changed = css.replace(declaration, `$1var(${token})`);
  if (changed === css) {
    throw new Error(`${recipe} has no ${property} to redirect`);
  }
  return changed;
}

function ratioOf(measurements: Measurement[], pair: string, theme: ThemeId): number {
  const found = measurements.find((m) => m.pair === pair && m.theme === theme);
  if (!found) {
    throw new Error(`Pair "${pair}" was not measured for the ${theme} theme`);
  }
  return found.ratio;
}

describe('parseThemeTokens', () => {
  it('reads the tokens of the named theme and of no other', () => {
    const css =
      ":root[data-theme='light'] { --bg: #fff; }\n:root[data-theme='dark'] { --bg: #000; }";

    expect(parseThemeTokens(css, 'light')['--bg']).toBe('#fff');
    expect(parseThemeTokens(css, 'dark')['--bg']).toBe('#000');
  });

  it('reads a selector list that names the theme, as the default theme under :root does', () => {
    const css = ":root, :root[data-theme='dark'] { --bg: #000; }";

    expect(parseThemeTokens(css, 'dark')['--bg']).toBe('#000');
    expect(parseThemeTokens(css, 'light')).toEqual({});
  });

  it('does not read a bare :root block as the tokens of any theme', () => {
    const css = ':root { --dock-compact-height: 284px; }';

    expect(parseThemeTokens(css, 'light')).toEqual({});
    expect(parseThemeTokens(css, 'dark')).toEqual({});
  });

  it('lets a later declaration of the same token win and ignores comments', () => {
    const css =
      "/* --bg: red; */ :root[data-theme='light'] { --bg: #111; }\n:root[data-theme='light'] { --bg: #222; /* note */ }";

    expect(parseThemeTokens(css, 'light')['--bg']).toBe('#222');
  });

  it('keeps multi-line values intact', () => {
    const css =
      ":root[data-theme='light'] {\n  --chrome: linear-gradient(\n    180deg,\n    #fff, #000\n  );\n}";

    expect(parseThemeTokens(css, 'light')['--chrome']).toBe(
      'linear-gradient(\n    180deg,\n    #fff, #000\n  )',
    );
  });
});

/**
 * The colour tokens (a value with a colour or a gradient or shadow of colours) at the time the vertical
 * layout was specified. The layout adds none (design-system "The rail reuses the existing surface
 * families"); adding one is a deliberate change of the design language and edits this list.
 */
const COLOUR_TOKENS_BEFORE_LAYOUT_OPTIONS = [
  '--accent',
  '--accent-ink',
  '--band',
  '--band-shadow',
  '--bg',
  '--card',
  '--card-hover',
  '--card-line',
  '--card-line-hover',
  '--card-shadow',
  '--card-shadow-hover',
  '--chrome',
  '--chrome-line',
  '--clock-ink',
  '--down',
  '--down-bg',
  '--field',
  '--field-border',
  '--focus',
  '--focus-halo',
  '--glass-shadow',
  '--icon-shadow',
  '--icon-tile',
  '--line',
  '--line-strong',
  '--menu',
  '--minute-fill',
  '--muted',
  '--pill-bg',
  '--pill-line',
  '--scrim',
  '--surface',
  '--surface-2',
  '--text',
  '--up',
  '--up-bg',
];

describe('token stylesheet', () => {
  it('declares in every registered theme exactly the token names of the others, so none leaks across themes', () => {
    const names = themes.map(({ id, css }) => [id, Object.keys(parseThemeTokens(css, id)).sort()]);
    const [, reference] = names[0];

    expect(reference.length).toBeGreaterThan(0);
    for (const [id, declared] of names) expect(declared, `tokens of ${id}`).toEqual(reference);
  });

  it.each(THEMES)(
    '$id has its stylesheet imported by styles.css and declaring its tokens',
    ({ id }) => {
      const { css } = themes.find((theme) => theme.id === id) as ThemeStylesheet;

      expect(css, `themes/${id}.css is missing or empty`).not.toBe('');
      expect(stylesCss).toContain(`@import './styles/themes/${id}.css';`);
      expect(
        Object.keys(parseThemeTokens(css, id)).length,
        `:root[data-theme='${id}']`,
      ).toBeGreaterThan(0);
    },
  );

  it.each(THEMES)(
    'sets color-scheme: $background in $id, so native controls follow the theme',
    ({ id, background }) => {
      const { css } = themes.find((theme) => theme.id === id) as ThemeStylesheet;

      expect(css).toMatch(new RegExp(`color-scheme:\\s*${background}\\s*;`));
    },
  );

  it('lets only the default theme answer to a bare :root, so a page with no data-theme paints it', () => {
    const answersBareRoot = (css: string) =>
      /(?:^|\})\s*:root\s*[,{]/.test(css.replace(/\/\*[\s\S]*?\*\//g, ''));

    expect(themes.filter(({ css }) => answersBareRoot(css)).map(({ id }) => id)).toEqual([
      DEFAULT_THEME,
    ]);
  });

  it('keeps no theme token in tokens.css: only the non-theme constant on :root, besides the @theme mapping', () => {
    const shared = tokensCss
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@theme inline\s*\{[^}]*\}/, '');

    expect([...shared.matchAll(/(--[\w-]+)\s*:/g)].map(([, name]) => name)).toEqual([
      '--dock-compact-height',
    ]);
    expect(shared).not.toContain('.dark');
    for (const { id, css } of themes) {
      expect(parseThemeTokens(css, id)).not.toHaveProperty('--dock-compact-height');
    }
  });

  it.each([
    ['--bg', '#F3F1EC', '#0D0F11'],
    ['--text', '#16181B', '#EDEBE6'],
    ['--accent', '#9A5B00', '#F0B04A'],
    ['--minute-fill', 'rgba(154,91,0,0.75)', 'rgba(240,176,74,0.85)'],
    ['--band', 'rgba(243,241,236,0.55)', 'rgba(13,15,17,0.62)'],
  ])('resolves %s to the specified value in light and in dark', (token, light, dark) => {
    expect(parseColor(tokensOf('light')[token])).toEqual(parseColor(light));
    expect(parseColor(tokensOf('dark')[token])).toEqual(parseColor(dark));
  });

  it.each([
    ['--bg', '#1E1E2E'],
    ['--scrim', 'rgba(30,30,46,0.8)'],
    ['--surface', '#181825'],
    ['--text', '#CDD6F4'],
    ['--muted', '#A6ADC8'],
    ['--accent', '#CBA6F7'],
    ['--accent-ink', '#11111B'],
    ['--minute-fill', 'rgba(203,166,247,0.85)'],
    ['--field-border', 'rgba(205,214,244,0.5)'],
    ['--focus', '#CBA6F7'],
    ['--focus-halo', 'rgba(17,17,27,0.9)'],
    ['--band', 'rgba(24,24,37,0.72)'],
  ])('resolves %s to the specified value in catppuccin-mocha', (token, expected) => {
    expect(parseColor(tokensOf('catppuccin-mocha')[token])).toEqual(parseColor(expected));
  });

  it("gives Catppuccin Mocha the shared recipes' floors: 0.15 on the bar, 0.35 on cards, 0.15 on the clock", () => {
    const tokens = tokensOf('catppuccin-mocha');

    expect([tokens['--floor-bar'], tokens['--floor-card'], tokens['--floor-clock']]).toEqual([
      '0.15',
      '0.35',
      '0.15',
    ]);
  });

  it('keeps the set of colour tokens the design had before the vertical layout: none is added for it', () => {
    const colour = /rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/i;

    expect(
      Object.entries(tokensOf('light'))
        .filter(([, value]) => colour.test(value))
        .map(([name]) => name)
        .sort(),
    ).toEqual(COLOUR_TOKENS_BEFORE_LAYOUT_OPTIONS);
  });
});

describe('token contrast audit', () => {
  const pairs = [
    'text on card',
    'muted on card',
    'accent text on card',
    'UP on its pill',
    'DOWN on its pill',
    'text on bar',
    'muted on bar',
    'accent underline on bar',
    'clock hours on widget',
    'colon and minute stroke on widget',
    'minute digits fill only',
    'muted on widget',
    'date pill text',
    'weekday pill ink on accent',
    'focus ring on card',
    'focus ring on bar',
    'field border vs card',
    'field border vs field',
    // The vertical layout's rail (spec design-system "Contrast pairs of the rail")
    'text on rail',
    'muted on rail',
    'brand description on rail',
    'version and credit on rail',
    'unselected category on rail',
    'selected category on its tint',
    'selected category marker on its tint',
    'search text on field',
    'search placeholder on field',
    'placeholder on configurator field',
    'main heading on its pill',
    'item count on its pill',
    'setup eyebrow on card tile',
    // The Layout control of the configurator (spec yaml-configurator "Layout control accessibility")
    'muted on layout panel',
    'text on unselected layout card',
    'muted on unselected layout card',
    'text on selected layout card',
    'muted on selected layout card',
    'muted on closed layout summary',
    'unselected layout radio ring',
    'selected layout border',
    'layout check mark on its dot',
  ];

  it('finds no pair below its required ratio in any registered theme', () => {
    const summaries = auditTokens(themes, surfacesCss).map(
      (v) => `${v.pair} (${v.theme}): ${v.ratio.toFixed(2)} < ${v.required}`,
    );

    expect(summaries).toEqual([]);
  });

  it('measures every pair of the design in every registered theme, with and without backdrop-filter', () => {
    const measurements = measureTokens(themes, surfacesCss);
    const expected = [
      ...pairs,
      'muted on hovered card',
      ...pairs.map((pair) => `${pair} (no blur)`),
    ].sort();

    expect([...new Set(measurements.map((m) => m.theme))].sort()).toEqual([...THEME_IDS].sort());
    for (const theme of THEME_IDS) {
      const measured = measurements.filter((m) => m.theme === theme).map((m) => m.pair);
      expect(measured.sort()).toEqual(expected);
    }
  });

  it.each(THEME_IDS)(
    'keeps minute fill, field border and focus ring at 3:1 or better in %s',
    (theme) => {
      const measurements = measureTokens(themes, surfacesCss);

      expect(ratioOf(measurements, 'minute digits fill only', theme)).toBeGreaterThanOrEqual(3);
      expect(ratioOf(measurements, 'field border vs card', theme)).toBeGreaterThanOrEqual(3);
      expect(ratioOf(measurements, 'field border vs field', theme)).toBeGreaterThanOrEqual(3);
      expect(ratioOf(measurements, 'focus ring on card', theme)).toBeGreaterThanOrEqual(3);
      expect(ratioOf(measurements, 'focus ring on bar', theme)).toBeGreaterThanOrEqual(3);
    },
  );

  it('fails and names the pair and theme when --floor-card is lowered in light', () => {
    const doctored = withOverrides({ light: '--floor-card: 0.2;' });

    const violations = auditTokens(doctored, surfacesCss);

    expect(violations.map((v) => [v.pair, v.theme])).toEqual(
      expect.arrayContaining([
        ['UP on its pill', 'light'],
        ['DOWN on its pill', 'light'],
      ]),
    );
    expect(violations.every((v) => v.theme === 'light')).toBe(true);
    expect(violations.every((v) => v.ratio < v.required)).toBe(true);
  });

  it.each(THEME_IDS)('names the pair and %s when that theme has a weak field border', (theme) => {
    const doctored = withOverrides({ [theme]: '--field-border: rgba(128, 128, 128, 0.2);' });

    const violations = auditTokens(doctored, surfacesCss);

    expect(violations.map((v) => [v.pair, v.theme])).toEqual(
      expect.arrayContaining([['field border vs card', theme]]),
    );
    expect(violations.every((v) => v.theme === theme)).toBe(true);
  });

  it('catches a Mocha field border at 0.45, which leaves the unselected layout radio ring under 3 : 1', () => {
    const weak = withOverrides({
      'catppuccin-mocha': '--field-border: rgba(205, 214, 244, 0.45);',
    });

    const violations = auditTokens(weak, surfacesCss);
    const ring = violations.find((v) => v.pair === 'unselected layout radio ring');

    expect(violations.map((v) => [v.pair, v.theme])).toEqual([
      ['unselected layout radio ring', 'catppuccin-mocha'],
    ]);
    expect(ring?.ratio).toBeCloseTo(2.95, 1);
    expect(ring?.required).toBe(3);
  });

  it('reproduces the "before" figures of design.md §5 when audited with the mockup tokens', () => {
    // Mockup: minute fill 0.42 (dark) / 0.32 (light) and no legibility floors.
    const mockup = withOverrides({
      light:
        '--minute-fill: rgba(154,91,0,0.32); --floor-bar: 0; --floor-card: 0; --floor-clock: 0;',
      dark: '--minute-fill: rgba(240,176,74,0.42); --floor-bar: 0; --floor-card: 0; --floor-clock: 0;',
    });

    const measurements = measureTokens(mockup, surfacesCss);

    expect(ratioOf(measurements, 'minute digits fill only', 'dark')).toBeCloseTo(2.02, 1);
    expect(ratioOf(measurements, 'minute digits fill only', 'light')).toBeCloseTo(1.16, 1);
    expect(ratioOf(measurements, 'colon and minute stroke on widget', 'light')).toBeCloseTo(
      1.51,
      1,
    );
  });

  it('reports the missing token instead of computing a ratio from nothing', () => {
    const incomplete: ThemeStylesheet[] = [
      { id: 'light', css: ":root[data-theme='light'] { --bg: #fff; }" },
      { id: 'dark', css: ":root[data-theme='dark'] { --bg: #000; }" },
    ];

    expect(() => measureTokens(incomplete, surfacesCss)).toThrow(/--scrim/);
  });

  it('audits the rail through the bar recipe: dropping --floor-bar fails the rail pairs, not the card ones', () => {
    const noBarFloor = withOverrides({ light: '--floor-bar: 0;', dark: '--floor-bar: 0;' });

    const failing = auditTokens(noBarFloor, surfacesCss).map((v) => v.pair);

    expect(failing).toEqual(
      expect.arrayContaining([
        'muted on rail',
        'selected category marker on its tint',
        'item count on its pill',
      ]),
    );
    expect(failing).not.toContain('setup eyebrow on card tile');
  });
});

describe('surface recipes', () => {
  it('are audited with the floor they declare, not a fixed token', () => {
    const lowCardFloor = withOverrides({ light: '--floor-card: 0.2;' });
    const lightPairs = (css: string) =>
      auditTokens(lowCardFloor, css)
        .filter((v) => v.theme === 'light')
        .map((v) => v.pair);
    const clockFloor = redirect(surfacesCss, 'glass-card', '--glass-floor', '--floor-clock');

    expect(lightPairs(surfacesCss)).toEqual(
      expect.arrayContaining(['UP on its pill', 'DOWN on its pill', 'field border vs card']),
    );
    expect(lightPairs(clockFloor)).not.toContain('UP on its pill');
    expect(lightPairs(clockFloor)).not.toContain('DOWN on its pill');
  });

  it('are audited with the glass layer they declare', () => {
    // In light, make the hover layer solid black: text on a card that paints it is unreadable.
    const blackHover = withOverrides({ light: '--card-hover: rgba(0,0,0,1);' });
    const textOnCard = (css: string) =>
      ratioOf(measureTokens(blackHover, css), 'text on card', 'light');
    const paintsHover = redirect(surfacesCss, 'glass-card', '--glass-layer', '--card-hover');

    expect(textOnCard(surfacesCss)).toBeGreaterThan(10);
    expect(textOnCard(paintsHover)).toBeLessThan(2);
  });

  it('are rejected by the audit when a recipe declares no legibility floor', () => {
    const noFloor = surfacesCss.replace(/--glass-floor:[^;]*;/g, '');

    expect(() => auditTokens(themes, noFloor)).toThrow(/glass-\w+.*floor/i);
  });

  it('are rejected by the audit when a recipe declares a floor but never paints it', () => {
    const unpainted = surfacesCss.replace(/var\(--glass-floor\)/g, '0');

    expect(() => auditTokens(themes, unpainted)).toThrow(/glass-\w+.*floor/i);
  });

  it('fall back to an opaque --surface so text keeps its contrast without backdrop-filter', () => {
    const measurements = measureTokens(themes, surfacesCss);

    for (const { id, css } of themes) {
      const set = parseThemeTokens(css, id);
      const expected = contrastRatio(parseColor(set['--text']), parseColor(set['--surface']));
      expect(ratioOf(measurements, 'text on card (no blur)', id)).toBeCloseTo(expected, 6);
    }
  });

  it('are rejected by the audit when the fallback is not opaque', () => {
    const translucent = redirect(surfacesCss, 'glass-card', '--glass-fallback', '--scrim');

    expect(() => auditTokens(themes, translucent)).toThrow(/opaque/i);
  });
});
