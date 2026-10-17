import { promises as fs } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { contrastRatio, parseColor } from '../testing/contrast';
import { auditTokens, measureTokens, parseTokens, type Measurement } from '../testing/token-audit';

let tokensCss: string;
let surfacesCss: string;

beforeAll(async () => {
  const read = (file: string) => fs.readFile(path.join(process.cwd(), 'src/styles', file), 'utf8');
  [tokensCss, surfacesCss] = await Promise.all([read('tokens.css'), read('surfaces.css')]);
});

/** Appends later declarations, which win the cascade, to simulate a changed token. */
function withOverrides(css: string, light: string, dark: string): string {
  return `${css}\n:root { ${light} }\n.dark { ${dark} }\n`;
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

function ratioOf(measurements: Measurement[], pair: string, theme: 'light' | 'dark'): number {
  const found = measurements.find((m) => m.pair === pair && m.theme === theme);
  if (!found) {
    throw new Error(`Pair "${pair}" was not measured for the ${theme} theme`);
  }
  return found.ratio;
}

describe('parseTokens', () => {
  it('reads :root as the light set and .dark as the dark set', () => {
    const { light, dark } = parseTokens(':root { --bg: #fff; } .dark { --bg: #000; }');

    expect(light['--bg']).toBe('#fff');
    expect(dark['--bg']).toBe('#000');
  });

  it('lets a later declaration of the same token win and ignores comments', () => {
    const { light } = parseTokens(
      '/* --bg: red; */ :root { --bg: #111; }\n:root { --bg: #222; /* note */ }',
    );

    expect(light['--bg']).toBe('#222');
  });

  it('keeps multi-line values intact', () => {
    const { light } = parseTokens(
      ':root {\n  --chrome: linear-gradient(\n    180deg,\n    #fff, #000\n  );\n}',
    );

    expect(light['--chrome']).toBe('linear-gradient(\n    180deg,\n    #fff, #000\n  )');
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
  it('defines in the dark set every token the light set defines, so none leaks across themes', () => {
    const { light, dark } = parseTokens(tokensCss);

    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it.each([
    ['--bg', '#F3F1EC', '#0D0F11'],
    ['--text', '#16181B', '#EDEBE6'],
    ['--accent', '#9A5B00', '#F0B04A'],
    ['--minute-fill', 'rgba(154,91,0,0.75)', 'rgba(240,176,74,0.85)'],
    ['--band', 'rgba(243,241,236,0.55)', 'rgba(13,15,17,0.62)'],
  ])('resolves %s to the specified value in light and in dark', (token, light, dark) => {
    const tokens = parseTokens(tokensCss);

    expect(parseColor(tokens.light[token])).toEqual(parseColor(light));
    expect(parseColor(tokens.dark[token])).toEqual(parseColor(dark));
  });

  it('keeps the set of colour tokens the design had before the vertical layout: none is added for it', () => {
    const { light } = parseTokens(tokensCss);
    const colour = /rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/i;

    expect(
      Object.entries(light)
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
    'main heading on its pill',
    'item count on its pill',
    'setup eyebrow on card tile',
  ];

  it('finds no pair below its required ratio in either theme', () => {
    const summaries = auditTokens(tokensCss, surfacesCss).map(
      (v) => `${v.pair} (${v.theme}): ${v.ratio.toFixed(2)} < ${v.required}`,
    );

    expect(summaries).toEqual([]);
  });

  it('measures every pair of the design in both themes, with and without backdrop-filter', () => {
    const measurements = measureTokens(tokensCss, surfacesCss);
    const expected = [
      ...pairs,
      'muted on hovered card',
      ...pairs.map((pair) => `${pair} (no blur)`),
    ].sort();

    for (const theme of ['light', 'dark'] as const) {
      const measured = measurements.filter((m) => m.theme === theme).map((m) => m.pair);
      expect(measured.sort()).toEqual(expected);
    }
  });

  it.each(['light', 'dark'] as const)(
    'keeps minute fill, field border and focus ring at 3:1 or better in %s',
    (theme) => {
      const measurements = measureTokens(tokensCss, surfacesCss);

      expect(ratioOf(measurements, 'minute digits fill only', theme)).toBeGreaterThanOrEqual(3);
      expect(ratioOf(measurements, 'field border vs card', theme)).toBeGreaterThanOrEqual(3);
      expect(ratioOf(measurements, 'field border vs field', theme)).toBeGreaterThanOrEqual(3);
      expect(ratioOf(measurements, 'focus ring on card', theme)).toBeGreaterThanOrEqual(3);
      expect(ratioOf(measurements, 'focus ring on bar', theme)).toBeGreaterThanOrEqual(3);
    },
  );

  it('fails and names the pair and theme when --floor-card is lowered in light', () => {
    const doctored = withOverrides(tokensCss, '--floor-card: 0.2;', '');

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

  it('reproduces the "before" figures of design.md §5 when audited with the mockup tokens', () => {
    // Mockup: minute fill 0.42 (dark) / 0.32 (light) and no legibility floors.
    const mockup = withOverrides(
      tokensCss,
      '--minute-fill: rgba(154,91,0,0.32); --floor-bar: 0; --floor-card: 0; --floor-clock: 0;',
      '--minute-fill: rgba(240,176,74,0.42); --floor-bar: 0; --floor-card: 0; --floor-clock: 0;',
    );

    const measurements = measureTokens(mockup, surfacesCss);

    expect(ratioOf(measurements, 'minute digits fill only', 'dark')).toBeCloseTo(2.02, 1);
    expect(ratioOf(measurements, 'minute digits fill only', 'light')).toBeCloseTo(1.16, 1);
    expect(ratioOf(measurements, 'colon and minute stroke on widget', 'light')).toBeCloseTo(
      1.51,
      1,
    );
  });

  it('reports the missing token instead of computing a ratio from nothing', () => {
    const incomplete = ':root { --bg: #fff; } .dark { --bg: #000; }';

    expect(() => measureTokens(incomplete, surfacesCss)).toThrow(/--scrim/);
  });

  it('audits the rail through the bar recipe: dropping --floor-bar fails the rail pairs, not the card ones', () => {
    const noBarFloor = withOverrides(tokensCss, '--floor-bar: 0;', '--floor-bar: 0;');

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
    const lowCardFloor = withOverrides(tokensCss, '--floor-card: 0.2;', '');
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
    const blackHover = withOverrides(tokensCss, '--card-hover: rgba(0,0,0,1);', '');
    const textOnCard = (css: string) =>
      ratioOf(measureTokens(blackHover, css), 'text on card', 'light');
    const paintsHover = redirect(surfacesCss, 'glass-card', '--glass-layer', '--card-hover');

    expect(textOnCard(surfacesCss)).toBeGreaterThan(10);
    expect(textOnCard(paintsHover)).toBeLessThan(2);
  });

  it('are rejected by the audit when a recipe declares no legibility floor', () => {
    const noFloor = surfacesCss.replace(/--glass-floor:[^;]*;/g, '');

    expect(() => auditTokens(tokensCss, noFloor)).toThrow(/glass-\w+.*floor/i);
  });

  it('are rejected by the audit when a recipe declares a floor but never paints it', () => {
    const unpainted = surfacesCss.replace(/var\(--glass-floor\)/g, '0');

    expect(() => auditTokens(tokensCss, unpainted)).toThrow(/glass-\w+.*floor/i);
  });

  it('fall back to an opaque --surface so text keeps its contrast without backdrop-filter', () => {
    const measurements = measureTokens(tokensCss, surfacesCss);
    const { light, dark } = parseTokens(tokensCss);

    for (const [theme, set] of [
      ['light', light],
      ['dark', { ...light, ...dark }],
    ] as const) {
      const expected = contrastRatio(parseColor(set['--text']), parseColor(set['--surface']));
      expect(ratioOf(measurements, 'text on card (no blur)', theme)).toBeCloseTo(expected, 6);
    }
  });

  it('are rejected by the audit when the fallback is not opaque', () => {
    const translucent = redirect(surfacesCss, 'glass-card', '--glass-fallback', '--scrim');

    expect(() => auditTokens(tokensCss, translucent)).toThrow(/opaque/i);
  });
});
