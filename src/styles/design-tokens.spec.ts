import { promises as fs } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { parseColor } from '../testing/contrast';
import { auditTokens, measureTokens, parseTokens, type Measurement } from '../testing/token-audit';

let tokensCss: string;

beforeAll(async () => {
  tokensCss = await fs.readFile(path.join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
});

/** Appends later declarations, which win the cascade, to simulate a changed token. */
function withOverrides(css: string, light: string, dark: string): string {
  return `${css}\n:root { ${light} }\n.dark { ${dark} }\n`;
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

describe('token stylesheet', () => {
  it('defines in the dark set every token the light set defines, so none leaks across themes', () => {
    const { light, dark } = parseTokens(tokensCss);

    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it.each([
    ['--bg', '#F3F1EC', '#0D0F11'],
    ['--text', '#16181B', '#EDEBE6'],
    ['--accent', '#9A5B00', '#F0B04A'],
    ['--minute-fill', 'rgba(154,91,0,0.75)', 'rgba(240,176,74,0.65)'],
  ])('resolves %s to the specified value in light and in dark', (token, light, dark) => {
    const tokens = parseTokens(tokensCss);

    expect(parseColor(tokens.light[token])).toEqual(parseColor(light));
    expect(parseColor(tokens.dark[token])).toEqual(parseColor(dark));
  });
});

describe('token contrast audit', () => {
  it('finds no pair below its required ratio in either theme', () => {
    const summaries = auditTokens(tokensCss).map(
      (v) => `${v.pair} (${v.theme}): ${v.ratio.toFixed(2)} < ${v.required}`,
    );

    expect(summaries).toEqual([]);
  });

  it('measures every pair of the design in both themes', () => {
    const measurements = measureTokens(tokensCss);
    const pairs = [
      'text on card',
      'muted on card',
      'muted on hovered card',
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
    ];

    for (const theme of ['light', 'dark'] as const) {
      const measured = measurements.filter((m) => m.theme === theme).map((m) => m.pair);
      expect(measured.sort()).toEqual([...pairs].sort());
    }
  });

  it.each(['light', 'dark'] as const)(
    'keeps minute fill, field border and focus ring at 3:1 or better in %s',
    (theme) => {
      const measurements = measureTokens(tokensCss);

      expect(ratioOf(measurements, 'minute digits fill only', theme)).toBeGreaterThanOrEqual(3);
      expect(ratioOf(measurements, 'field border vs card', theme)).toBeGreaterThanOrEqual(3);
      expect(ratioOf(measurements, 'field border vs field', theme)).toBeGreaterThanOrEqual(3);
      expect(ratioOf(measurements, 'focus ring on card', theme)).toBeGreaterThanOrEqual(3);
      expect(ratioOf(measurements, 'focus ring on bar', theme)).toBeGreaterThanOrEqual(3);
    },
  );

  it('fails and names the pair and theme when --floor-card is lowered in light', () => {
    const doctored = withOverrides(tokensCss, '--floor-card: 0.2;', '');

    const violations = auditTokens(doctored);

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

    const measurements = measureTokens(mockup);

    expect(ratioOf(measurements, 'minute digits fill only', 'dark')).toBeCloseTo(2.02, 1);
    expect(ratioOf(measurements, 'minute digits fill only', 'light')).toBeCloseTo(1.16, 1);
    expect(ratioOf(measurements, 'colon and minute stroke on widget', 'light')).toBeCloseTo(
      1.51,
      1,
    );
  });

  it('reports the missing token instead of computing a ratio from nothing', () => {
    const incomplete = ':root { --bg: #fff; } .dark { --bg: #000; }';

    expect(() => measureTokens(incomplete)).toThrow(/--scrim/);
  });
});
