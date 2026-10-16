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

/**
 * The stack a surface recipe in surfaces.css declares, as token names: the opaque `--surface` floor at
 * the opacity of `floor`, then `layer` (colour or gradient). `fallback` is painted alone, opaque,
 * where backdrop-filter is unsupported.
 */
interface Recipe {
  floor: string;
  layer: string;
  fallback: string;
}

const RECIPES = ['glass-card', 'glass-chrome', 'glass-clock'] as const;
type RecipeName = (typeof RECIPES)[number];
type Recipes = Record<RecipeName, Recipe>;

/** The text of the `{ … }` block that opens at `open`, nested blocks included. */
function blockAt(css: string, open: number): string {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0;
    if (depth === 0) {
      return css.slice(open + 1, i);
    }
  }
  throw new Error('Unbalanced braces in the surface stylesheet');
}

function readRecipes(css: string): Recipes {
  const source = css.replace(COMMENT, '');

  const read = (name: RecipeName): Recipe => {
    const opening = new RegExp(`@utility\\s+${name}\\s*\\{`).exec(source);
    if (!opening) {
      throw new Error(`Recipe ${name} is not defined in the surface stylesheet`);
    }
    const body = blockAt(source, opening.index + opening[0].length - 1);
    const declared = (property: string): string | undefined =>
      new RegExp(`${property}\\s*:\\s*var\\(\\s*(--[\\w-]+)\\s*\\)`).exec(body)?.[1];

    const floor = declared('--glass-floor');
    const layer = declared('--glass-layer');
    const fallback = declared('--glass-fallback');
    if (!floor) {
      throw new Error(`Recipe ${name} declares no legibility floor (--glass-floor)`);
    }
    if (!layer || !fallback) {
      throw new Error(`Recipe ${name} declares no ${layer ? '--glass-fallback' : '--glass-layer'}`);
    }
    // The floor is declared, turned into a colour (--glass-floor-color) and that colour is painted.
    if (!body.includes('var(--glass-floor)') || !body.includes('var(--glass-floor-color)')) {
      throw new Error(`Recipe ${name} declares the floor ${floor} but never paints it`);
    }
    return { floor, layer, fallback };
  };

  return Object.fromEntries(RECIPES.map((name) => [name, read(name)])) as Recipes;
}

/** Which recipe each audited surface is, and the layer to audit instead of the recipe's (hover). */
type SurfaceName = 'card' | 'cardHover' | 'bar' | 'widget';
const SURFACES: Record<SurfaceName, { recipe: RecipeName; layer?: string }> = {
  card: { recipe: 'glass-card' },
  cardHover: { recipe: 'glass-card', layer: '--card-hover' },
  bar: { recipe: 'glass-chrome' },
  widget: { recipe: 'glass-clock' },
};

interface Pair {
  name: string;
  surface: SurfaceName;
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

function measureTheme(theme: Theme, tokens: TokenSet, recipes: Recipes): Measurement[] {
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
  const contrastOn = (pair: Pair, background: Rgba) =>
    contrastRatio(paint(pair.ink, background), background);

  const withBlur = PAIRS.map((pair) => {
    const { recipe, layer: layerOverride } = SURFACES[pair.surface];
    const { floor: floorToken, layer: recipeLayer } = recipes[recipe];
    const floorOpacity = Number(token(floorToken));
    if (!Number.isFinite(floorOpacity)) {
      throw new Error(
        `Token ${floorToken} (${theme} theme) must be a number: ${token(floorToken)}`,
      );
    }
    const floor = { ...solid('--surface'), a: floorOpacity };

    let ratio = Infinity;
    for (const backdrop of BACKDROPS) {
      const floored = compositeOver(floor, compositeOver(scrim, backdrop));
      for (const stop of colors(layerOverride ?? recipeLayer)) {
        const background = paint(pair.on ?? [], compositeOver(stop, floored));
        ratio = Math.min(ratio, contrastOn(pair, background));
      }
    }
    return { pair: pair.name, theme, ratio, required: pair.required };
  });

  // Without backdrop-filter a recipe paints its opaque fallback colour alone, whatever is behind it.
  const withoutBlur = PAIRS.filter((pair) => pair.surface !== 'cardHover').map((pair) => {
    const { recipe } = SURFACES[pair.surface];
    const fallback = solid(recipes[recipe].fallback);
    if (fallback.a !== 1) {
      throw new Error(
        `Fallback ${recipes[recipe].fallback} of ${recipe} (${theme} theme) must be opaque`,
      );
    }
    const ratio = contrastOn(pair, paint(pair.on ?? [], fallback));
    return { pair: `${pair.name} (no blur)`, theme, ratio, required: pair.required };
  });

  return [...withBlur, ...withoutBlur];
}

/**
 * Contrast of every pair of design.md § 5 in both themes, each at its worst case, through the
 * surface stack the recipes in `surfacesCss` declare, with and without backdrop-filter.
 */
export function measureTokens(tokensCss: string, surfacesCss: string): Measurement[] {
  const { light, dark } = parseTokens(tokensCss);
  const recipes = readRecipes(surfacesCss);

  return [
    ...measureTheme('light', light, recipes),
    ...measureTheme('dark', { ...light, ...dark }, recipes),
  ];
}

/** The measurements that fall below their required ratio. */
export function auditTokens(tokensCss: string, surfacesCss: string): Measurement[] {
  return measureTokens(tokensCss, surfacesCss).filter((m) => m.ratio < m.required);
}
