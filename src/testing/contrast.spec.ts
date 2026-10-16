import { describe, expect, it } from 'vitest';

import { compositeOver, contrastRatio, luminance, parseColor } from './contrast';

describe('parseColor', () => {
  it('parses #RRGGBB as an opaque colour', () => {
    expect(parseColor('#F0B04A')).toEqual({ r: 240, g: 176, b: 74, a: 1 });
  });

  it('expands #RGB shorthand', () => {
    expect(parseColor('#fa0')).toEqual({ r: 255, g: 170, b: 0, a: 1 });
  });

  it('reads the alpha byte of #RRGGBBAA', () => {
    expect(parseColor('#FFFFFF80').a).toBeCloseTo(128 / 255, 10);
  });

  it('parses rgb() as opaque', () => {
    expect(parseColor('rgb(13, 15, 17)')).toEqual({ r: 13, g: 15, b: 17, a: 1 });
  });

  it('parses rgba() with decimal alpha, with or without a leading zero and extra spaces', () => {
    expect(parseColor('rgba(240,176,74,0.65)')).toEqual({ r: 240, g: 176, b: 74, a: 0.65 });
    expect(parseColor('  RGBA( 240 , 176 , 74 , .42 ) ')).toEqual({
      r: 240,
      g: 176,
      b: 74,
      a: 0.42,
    });
  });

  it.each(['', 'red', '#12', '#12345', '#GGGGGG', 'rgb(1,2)', 'rgba(1,2,3,4)', 'rgb(256,0,0)'])(
    'rejects %j instead of guessing',
    (input) => {
      expect(() => parseColor(input)).toThrow(/colou?r/i);
    },
  );
});

describe('compositeOver', () => {
  it('returns the top colour when it is opaque', () => {
    const top = parseColor('#F0B04A');

    expect(compositeOver(top, parseColor('#000000'))).toEqual(top);
  });

  it('returns the backdrop when the top colour is fully transparent', () => {
    const backdrop = parseColor('#171A1E');

    expect(compositeOver(parseColor('rgba(255,0,0,0)'), backdrop)).toEqual(backdrop);
  });

  it('blends rgba(240,176,74,.42) over #171A1E channel by channel without rounding', () => {
    const result = compositeOver(parseColor('rgba(240,176,74,.42)'), parseColor('#171A1E'));

    expect(result.r).toBeCloseTo(240 * 0.42 + 23 * 0.58, 10);
    expect(result.g).toBeCloseTo(176 * 0.42 + 26 * 0.58, 10);
    expect(result.b).toBeCloseTo(74 * 0.42 + 30 * 0.58, 10);
    expect(result.a).toBe(1);
  });

  it('accumulates alpha when the backdrop is itself translucent', () => {
    const white50 = parseColor('rgba(255,255,255,0.5)');
    const black50 = parseColor('rgba(0,0,0,0.5)');

    const result = compositeOver(white50, black50);

    expect(result.a).toBeCloseTo(0.75, 10);
    expect(result.r).toBeCloseTo(170, 10);
  });

  it('stacks layers bottom-up: floor, then glass, over a backdrop', () => {
    const backdrop = parseColor('#FFFFFF');
    const floor = parseColor('rgba(21,24,28,0.35)');
    const glass = parseColor('rgba(21,24,28,0.62)');

    const stacked = compositeOver(glass, compositeOver(floor, backdrop));

    // 255 → 255*.65 + 21*.35 = 173.1 → 173.1*.38 + 21*.62 = 78.798
    expect(stacked.r).toBeCloseTo(78.798, 3);
  });
});

describe('luminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(luminance(parseColor('#000000'))).toBe(0);
    expect(luminance(parseColor('#FFFFFF'))).toBeCloseTo(1, 10);
  });

  it('applies the sRGB transfer curve (#808080 ≈ 0.2159)', () => {
    expect(luminance(parseColor('#808080'))).toBeCloseTo(0.2159, 4);
  });

  it('weights channels by the WCAG coefficients', () => {
    expect(luminance(parseColor('#FF0000'))).toBeCloseTo(0.2126, 4);
    expect(luminance(parseColor('#00FF00'))).toBeCloseTo(0.7152, 4);
    expect(luminance(parseColor('#0000FF'))).toBeCloseTo(0.0722, 4);
  });

  it('uses the linear segment for very dark channels', () => {
    // 10/255 = 0.0392 is below the curve knee: c / 12.92
    expect(luminance(parseColor('#0A0A0A'))).toBeCloseTo(10 / 255 / 12.92, 6);
  });

  it('refuses a translucent colour, which has no luminance until composited', () => {
    expect(() => luminance(parseColor('rgba(0,0,0,0.5)'))).toThrow(/opaque/i);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio(parseColor('#000'), parseColor('#fff'))).toBeCloseTo(21, 10);
  });

  it('is 1 for identical colours', () => {
    expect(contrastRatio(parseColor('#F0B04A'), parseColor('#F0B04A'))).toBe(1);
  });

  it('is symmetric', () => {
    const a = parseColor('#9A5B00');
    const b = parseColor('#F3F1EC');

    expect(contrastRatio(a, b)).toBe(contrastRatio(b, a));
  });

  it('matches the published AA boundary: #767676 on white passes 4.5, #777777 does not', () => {
    const white = parseColor('#FFFFFF');

    expect(contrastRatio(parseColor('#767676'), white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(parseColor('#777777'), white)).toBeLessThan(4.5);
  });

  it('refuses a translucent colour so callers must composite explicitly', () => {
    expect(() => contrastRatio(parseColor('rgba(0,0,0,0.5)'), parseColor('#fff'))).toThrow(
      /opaque/i,
    );
  });
});
