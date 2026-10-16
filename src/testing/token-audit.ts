import { compositeOver, contrastRatio, parseColor, type Rgba } from './contrast';

export type Theme = 'light' | 'dark';
export type TokenSet = Record<string, string>;

export interface Measurement {
  pair: string;
  theme: Theme;
  /** Worst ratio over a black and a white backdrop and every stop of the surface gradient. */
  ratio: number;
  required: number;
}

const COMMENT = /\/\*[\s\S]*?\*\//g;
const BLOCK = /(:root|\.dark)\s*\{([^}]*)\}/g;
const DECLARATION = /(--[\w-]+)\s*:\s*([^;]+);/g;
const COLOR = /rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/gi;

/**
 * Reads the custom properties of every `:root` (light) and `.dark` (dark) block. Blocks may repeat;
 * a later declaration of the same token wins, as in the cascade.
 */
export function parseTokens(css: string): Record<Theme, TokenSet> {
  const sets: Record<Theme, TokenSet> = { light: {}, dark: {} };

  for (const [, selector, body] of css.replace(COMMENT, '').matchAll(BLOCK)) {
    const set = sets[selector === ':root' ? 'light' : 'dark'];
    for (const [, name, value] of body.matchAll(DECLARATION)) {
      set[name] = value.trim();
    }
  }
  return sets;
}

/** A glass surface: an opaque `--surface` floor at `floor` opacity, then the `layer` colour or gradient. */
interface Surface {
  floor: string;
  layer: string;
}

const SURFACES = {
  card: { floor: '--floor-card', layer: '--card' },
  cardHover: { floor: '--floor-card', layer: '--card-hover' },
  bar: { floor: '--floor-bar', layer: '--chrome' },
  widget: { floor: '--floor-clock', layer: '--chrome' },
} satisfies Record<string, Surface>;

interface Pair {
  name: string;
  surface: keyof typeof SURFACES;
  required: number;
  /** Tokens painted over the surface, in order, to form the backdrop of the ink. */
  on?: string[];
  /** Tokens painted over the backdrop, in order, to form the foreground. */
  ink: string[];
}

// design.md § 5. Text 4.5; large text and UI boundaries 3.
const PAIRS: Pair[] = [
  { name: 'text on card', surface: 'card', required: 4.5, ink: ['--text'] },
  { name: 'muted on card', surface: 'card', required: 4.5, ink: ['--muted'] },
  { name: 'muted on hovered card', surface: 'cardHover', required: 4.5, ink: ['--muted'] },
  { name: 'UP on its pill', surface: 'card', required: 4.5, on: ['--up-bg'], ink: ['--up'] },
  { name: 'DOWN on its pill', surface: 'card', required: 4.5, on: ['--down-bg'], ink: ['--down'] },
  { name: 'text on bar', surface: 'bar', required: 4.5, ink: ['--text'] },
  { name: 'muted on bar', surface: 'bar', required: 4.5, ink: ['--muted'] },
  { name: 'accent underline on bar', surface: 'bar', required: 3, ink: ['--accent'] },
  { name: 'clock hours on widget', surface: 'widget', required: 3, ink: ['--clock-ink'] },
  { name: 'colon and minute stroke on widget', surface: 'widget', required: 3, ink: ['--accent'] },
  { name: 'minute digits fill only', surface: 'widget', required: 3, ink: ['--minute-fill'] },
  { name: 'muted on widget', surface: 'widget', required: 4.5, ink: ['--muted'] },
  { name: 'date pill text', surface: 'widget', required: 4.5, on: ['--pill-bg'], ink: ['--text'] },
  {
    name: 'weekday pill ink on accent',
    surface: 'widget',
    required: 4.5,
    on: ['--accent'],
    ink: ['--accent-ink'],
  },
  { name: 'focus ring on card', surface: 'card', required: 3, ink: ['--focus'] },
  { name: 'focus ring on bar', surface: 'bar', required: 3, ink: ['--focus'] },
  {
    name: 'field border vs card',
    surface: 'card',
    required: 3,
    ink: ['--field', '--field-border'],
  },
  {
    name: 'field border vs field',
    surface: 'card',
    required: 3,
    on: ['--field'],
    ink: ['--field-border'],
  },
];

const BACKDROPS = [parseColor('#000000'), parseColor('#FFFFFF')];

function measureTheme(theme: Theme, tokens: TokenSet): Measurement[] {
  const token = (name: string): string => {
    const value = tokens[name];
    if (value === undefined) {
      throw new Error(`Missing token ${name} (${theme} theme)`);
    }
    return value;
  };
  const colors = (name: string): Rgba[] => (token(name).match(COLOR) ?? []).map(parseColor);
  const solid = (name: string): Rgba => {
    const [only, ...rest] = colors(name);
    if (!only || rest.length > 0) {
      throw new Error(`Token ${name} (${theme} theme) must be a single colour: ${token(name)}`);
    }
    return only;
  };

  const scrim = solid('--scrim');
  const paint = (layers: string[], backdrop: Rgba) =>
    layers.reduce((under, name) => compositeOver(solid(name), under), backdrop);

  return PAIRS.map((pair) => {
    const surface = SURFACES[pair.surface];
    const floorOpacity = Number(token(surface.floor));
    if (!Number.isFinite(floorOpacity)) {
      throw new Error(
        `Token ${surface.floor} (${theme} theme) must be a number: ${token(surface.floor)}`,
      );
    }
    const floor = { ...solid('--surface'), a: floorOpacity };

    let ratio = Infinity;
    for (const backdrop of BACKDROPS) {
      const floored = compositeOver(floor, compositeOver(scrim, backdrop));
      for (const stop of colors(surface.layer)) {
        const background = paint(pair.on ?? [], compositeOver(stop, floored));
        ratio = Math.min(ratio, contrastRatio(paint(pair.ink, background), background));
      }
    }
    return { pair: pair.name, theme, ratio, required: pair.required };
  });
}

/** Contrast of every pair of design.md § 5 in both themes, each at its worst case. */
export function measureTokens(css: string): Measurement[] {
  const { light, dark } = parseTokens(css);

  return [...measureTheme('light', light), ...measureTheme('dark', { ...light, ...dark })];
}

/** The measurements that fall below their required ratio. */
export function auditTokens(css: string): Measurement[] {
  return measureTokens(css).filter((m) => m.ratio < m.required);
}
