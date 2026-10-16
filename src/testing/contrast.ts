/** sRGB colour: channels 0–255, alpha 0–1. Channels are kept unrounded through compositing. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/i;

/** Parses `#RGB`, `#RRGGBB`, `#RRGGBBAA`, `rgb(r,g,b)` and `rgba(r,g,b,a)`; throws on anything else. */
export function parseColor(input: string): Rgba {
  const text = input.trim();

  const hex = HEX.exec(text);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join('') : hex[1];
    const byte = (i: number) => parseInt(digits.slice(i, i + 2), 16);
    return { r: byte(0), g: byte(2), b: byte(4), a: digits.length === 8 ? byte(6) / 255 : 1 };
  }

  const rgb = RGB.exec(text);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number);
    const a = rgb[4] === undefined ? 1 : Number(rgb[4]);
    if (r <= 255 && g <= 255 && b <= 255 && a <= 1) {
      return { r, g, b, a };
    }
  }

  throw new Error(`Unsupported colour: ${JSON.stringify(input)}`);
}

/** Source-over compositing of `top` onto `bottom` (non-premultiplied in and out). */
export function compositeOver(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const channel = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / a;
  return {
    r: channel(top.r, bottom.r),
    g: channel(top.g, bottom.g),
    b: channel(top.b, bottom.b),
    a,
  };
}

function assertOpaque(colour: Rgba): void {
  if (colour.a !== 1) {
    throw new Error(
      `Colour must be opaque (alpha ${colour.a}); composite it over a backdrop first`,
    );
  }
}

/** WCAG 2.x relative luminance of an opaque colour. */
export function luminance(colour: Rgba): number {
  assertOpaque(colour);

  const linear = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(colour.r) + 0.7152 * linear(colour.g) + 0.0722 * linear(colour.b);
}

/** WCAG 2.x contrast ratio (1–21) between two opaque colours, in either order. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
