import { describe, expect, it } from 'vitest';

import {
  evaluate,
  scrollTo,
  settle,
  startAt,
  type Decide,
  type SimState,
  type World,
} from '../../../testing/scroll-sim';
import {
  nextEligible,
  nextMode,
  remainingCapacity,
  type ChromeMode,
  type ScrollInput,
} from './scroll-state';

function input(overrides: Partial<ScrollInput>): ScrollInput {
  return {
    scrollY: 0,
    docHeight: 2000,
    viewportHeight: 900,
    delta: 306,
    mode: 'top',
    eligible: true,
    guardOk: true,
    ...overrides,
  };
}

/** Desktop dashboard dock: Δ = 306, sticky only from 720 px of viewport height. */
function desktop(rows: number, viewportHeight = 900): World {
  return { rows, viewportHeight, delta: 306, minViewportHeight: 720 };
}

describe('nextMode hysteresis', () => {
  it.each([
    ['top', 40, 'top'],
    ['top', 41, 'scrolled'],
    ['scrolled', 5, 'scrolled'],
    ['scrolled', 4, 'top'],
    ['scrolled', 0, 'top'],
    ['top', 5, 'top'],
  ] as [ChromeMode, number, ChromeMode][])(
    'from %s at scrollY %d gives %s',
    (mode, scrollY, expected) => {
      expect(nextMode(input({ mode, scrollY }))).toBe(expected);
    },
  );

  it('goes from static straight to the mode the scroll position calls for, in one step', () => {
    expect(nextMode(input({ mode: 'static', scrollY: 0 }))).toBe('top');
    expect(nextMode(input({ mode: 'static', scrollY: 41 }))).toBe('scrolled');
  });

  it.each(['top', 'scrolled', 'static'] as const)(
    'goes to static from %s when the chrome is not eligible',
    (mode) => {
      expect(nextMode(input({ mode, scrollY: 300, eligible: false }))).toBe('static');
    },
  );

  it.each(['top', 'scrolled', 'static'] as const)(
    'goes to static from %s when the viewport guard fails, however much the page can scroll',
    (mode) => {
      expect(nextMode(input({ mode, scrollY: 300, docHeight: 5000, guardOk: false }))).toBe(
        'static',
      );
    },
  );
});

describe('remainingCapacity', () => {
  it('is the scroll left after compaction: docTop − viewport − Δ', () => {
    expect(
      remainingCapacity({ docHeight: 1449, viewportHeight: 900, delta: 306, mode: 'top' }),
    ).toBe(243);
  });

  it('does not depend on the mode: a scrolled document is Δ shorter and R is the same', () => {
    const top = remainingCapacity({
      docHeight: 1449,
      viewportHeight: 900,
      delta: 306,
      mode: 'top',
    });
    const scrolled = remainingCapacity({
      docHeight: 1449 - 306,
      viewportHeight: 900,
      delta: 306,
      mode: 'scrolled',
    });
    const fixed = remainingCapacity({
      docHeight: 1449,
      viewportHeight: 900,
      delta: 306,
      mode: 'static',
    });

    expect(scrolled).toBe(top);
    expect(fixed).toBe(top);
  });
});

describe('nextEligible dead band', () => {
  it.each([
    [false, 79, false],
    [false, 80, true],
    [false, 60, false],
    [true, 56, true],
    [true, 55, false],
    [true, 70, true],
    [true, 200, true],
    [false, -300, false],
  ])('from eligible=%s at R=%d gives %s', (previous, r, expected) => {
    expect(nextEligible(previous, r)).toBe(expected);
  });
});

describe('worked example of design.md §4.1 (viewport 900, Δ 306)', () => {
  const rows = [1, 2, 3, 4, 5, 6, 7, 8];

  it('computes R for 1 to 8 rows of apps', () => {
    const capacities = rows.map((count) => {
      const world = desktop(count);
      const state = startAt(world);
      return remainingCapacity({
        docHeight: state.docHeight,
        viewportHeight: world.viewportHeight,
        delta: world.delta,
        mode: state.mode,
      });
    });

    expect(capacities).toEqual([-312, -127, 58, 243, 428, 613, 798, 983]);
  });

  it('is static for 1 to 3 rows and eligible from 4 rows', () => {
    expect(rows.map((count) => startAt(desktop(count)).eligible)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(rows.map((count) => startAt(desktop(count)).mode)).toEqual([
      'static',
      'static',
      'static',
      'top',
      'top',
      'top',
      'top',
      'top',
    ]);
  });

  it('changes state 0 times at 1 to 3 rows and exactly once at 4 or more rows when the user scrolls 200 px and holds', () => {
    const changes = rows.map((count) => {
      const world = desktop(count);
      return settle(world, scrollTo(startAt(world), 200)).modeChanges;
    });

    expect(changes).toEqual([0, 0, 0, 1, 1, 1, 1, 1]);
  });
});

describe('closed loop with the document and the browser clamp', () => {
  /** Hysteresis only: the scheme design.md §4.1 shows loops on short pages. */
  const hysteresisOnly: Decide = (i) => (i.guardOk ? nextMode({ ...i, eligible: true }) : 'static');

  it('the harness detects the naive scheme: 2 rows, 200 px held, flips on every evaluation', () => {
    const world = desktop(2);
    let state: SimState = scrollTo(startAt(world, hysteresisOnly), 200);
    let flips = 0;

    for (let step = 0; step < 40; step++) {
      const next = evaluate(world, state, hysteresisOnly);
      flips += next.mode === state.mode ? 0 : 1;
      state = next;
    }

    expect(flips).toBe(40);
    expect(() =>
      settle(world, scrollTo(startAt(world, hysteresisOnly), 200), hysteresisOnly),
    ).toThrow(/did not settle/);
  });

  it('never leaves a scrolled chrome at or below the exit threshold after compaction', () => {
    for (let count = 4; count <= 12; count++) {
      const world = desktop(count);
      const state = settle(world, scrollTo(startAt(world), 300)).state;

      expect(state.mode).toBe('scrolled');
      expect(state.scrollY).toBeGreaterThan(4);
    }
  });

  function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it.each([
    [10, 500],
    [16, 500],
    [306, 720],
  ])(
    'one input change causes at most one mode change and settles within 2 evaluations (Δ %d, guard %d px)',
    (delta, minViewportHeight) => {
      for (let seed = 1; seed <= 60; seed++) {
        const random = mulberry32(seed * 7919 + delta);
        const between = (low: number, high: number) =>
          low + Math.floor(random() * (high - low + 1));
        let world: World = {
          rows: between(1, 12),
          viewportHeight: between(500, 1200),
          delta,
          minViewportHeight,
        };
        let state = startAt(world);

        for (let event = 0; event < 300; event++) {
          const kind = between(0, 2);
          let label: string;
          if (kind === 0) {
            const y = [0, 3, 4, 5, 40, 41, between(0, 2500)][between(0, 6)];
            state = scrollTo(state, y);
            label = `scroll to ${y}`;
          } else if (kind === 1) {
            world = { ...world, rows: between(1, 12) };
            // The browser re-lays out and clamps inside the next evaluation.
            label = `rows ${world.rows}`;
          } else {
            world = { ...world, viewportHeight: between(500, 1200) };
            // The browser re-lays out and clamps inside the next evaluation.
            label = `viewport ${world.viewportHeight}`;
          }

          const result = settle(world, state);
          const context = `seed ${seed} event ${event} (${label}), ${JSON.stringify(world)}`;

          expect(result.modeChanges, context).toBeLessThanOrEqual(1);
          expect(result.evaluations, context).toBeLessThanOrEqual(2);
          if (result.state.mode === 'scrolled') {
            expect(result.state.scrollY, context).toBeGreaterThan(4);
          }
          state = result.state;
        }
      }
    },
  );
});
