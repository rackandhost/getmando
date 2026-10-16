import { promises as fs } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

const FONTS_CSS = path.join(process.cwd(), 'src/styles/fonts.css');

interface Face {
  family: string;
  weight: [number, number];
  display: string;
  urls: string[];
  subsets: string[];
}

let css: string;
let faces: Face[];

function declaration(body: string, property: string): string {
  const match = new RegExp(`${property}\\s*:\\s*([^;]+);`).exec(body);
  if (!match) {
    throw new Error(`@font-face without ${property}: ${body.trim()}`);
  }
  return match[1].trim();
}

function parseFaces(source: string): Face[] {
  return [...source.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => {
    const src = declaration(body, 'src');
    const urls = [...src.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)].map((m) => m[1]);
    const [min, max = min] = declaration(body, 'font-weight').split(/\s+/).map(Number);
    return {
      family: declaration(body, 'font-family').replace(/['"]/g, ''),
      weight: [min, max],
      display: declaration(body, 'font-display'),
      urls,
      subsets: urls.map(
        (url) => /-(latin-ext|latin|[a-z]+)-(?:\d+|wght)-normal\.\w+$/.exec(url)?.[1] ?? '?',
      ),
    };
  });
}

beforeAll(async () => {
  css = await fs.readFile(FONTS_CSS, 'utf8');
  faces = parseFaces(css);
});

describe('self-hosted font faces', () => {
  it('declares Nunito Variable and IBM Plex Mono and no other family', () => {
    expect([...new Set(faces.map((f) => f.family))].sort()).toEqual([
      'IBM Plex Mono',
      'Nunito Variable',
    ]);
  });

  it('declares only the latin and latin-ext subsets', () => {
    expect(faces.length).toBeGreaterThan(0);
    expect([...new Set(faces.flatMap((f) => f.subsets))].sort()).toEqual(['latin', 'latin-ext']);
  });

  it('declares IBM Plex Mono at 400, 500 and 600 in each subset', () => {
    const plex = faces.filter((f) => f.family === 'IBM Plex Mono');

    const declared = plex.map((f) => `${f.weight[0]}:${f.subsets[0]}`).sort();

    expect(declared).toEqual([
      '400:latin',
      '400:latin-ext',
      '500:latin',
      '500:latin-ext',
      '600:latin',
      '600:latin-ext',
    ]);
  });

  it('declares Nunito Variable once per subset, covering weights 400 to 800', () => {
    const nunito = faces.filter((f) => f.family === 'Nunito Variable');

    expect(nunito.map((f) => f.subsets[0]).sort()).toEqual(['latin', 'latin-ext']);
    for (const face of nunito) {
      expect(face.weight[0]).toBeLessThanOrEqual(400);
      expect(face.weight[1]).toBeGreaterThanOrEqual(800);
    }
  });

  it('serves every file from the application: relative woff2 URLs, no third-party host', () => {
    for (const url of faces.flatMap((f) => f.urls)) {
      expect(url, url).not.toMatch(/^(?:[a-z][a-z0-9+.-]*:)?\/\//i);
      expect(url, url).toMatch(/^\.{1,2}\//);
      expect(url, url).toMatch(/\.woff2$/);
    }
  });

  it('points every URL at a file that exists', async () => {
    for (const url of faces.flatMap((f) => f.urls)) {
      await expect(
        fs.access(path.resolve(path.dirname(FONTS_CSS), url)),
        url,
      ).resolves.toBeUndefined();
    }
  });

  it('keeps text visible while a font loads', () => {
    for (const face of faces) {
      expect(face.display, `${face.family} ${face.weight.join(' ')}`).toBe('swap');
    }
  });
});

describe('font stacks', () => {
  const stack = (name: string): string[] => {
    const match = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(css);
    if (!match) {
      throw new Error(`${name} is not defined in fonts.css`);
    }
    return match[1].split(',').map((family) => family.trim().replace(/['"]/g, ''));
  };

  it('puts Nunito Variable first and falls back to system sans-serif fonts', () => {
    const sans = stack('--font-sans');

    expect(sans[0]).toBe('Nunito Variable');
    expect(sans).toEqual(expect.arrayContaining(['system-ui', 'sans-serif']));
  });

  it('puts IBM Plex Mono first and falls back to a monospace font', () => {
    const mono = stack('--font-mono');

    expect(mono[0]).toBe('IBM Plex Mono');
    expect(mono.at(-1)).toBe('monospace');
  });
});
