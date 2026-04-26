import {describe, expect, it} from 'vitest';

// @ts-ignore — Node built-in not available in Angular compiler types
import {readFileSync} from 'fs';

declare const process: {
  cwd(): string;
};

const readFile = (relativePath: string): string => {
  const base = process.cwd() + '/src/app/';
  // @ts-ignore
  return readFileSync(base + relativePath, 'utf-8');
};

describe('Safari iPhone white bars fix (Issue #16)', () => {
  describe('index.html', () => {
    it('should have viewport meta tag with viewport-fit=cover', () => {
      const html = readFile('../index.html');
      const viewportMatch = html.match(/<meta[^>]+name="viewport"[^>]*>/i);
      expect(viewportMatch).toBeTruthy();
      expect(viewportMatch![0]).toContain('viewport-fit=cover');
    });
  });

  describe('styles.css', () => {
    it('should have body with min-height: 100dvh and 100vh fallback', () => {
      const css = readFile('../styles.css');
      // Extract the body rule block
      const bodyMatch = css.match(/body\s*\{([^}]*)\}/s);
      expect(bodyMatch).toBeTruthy();
      const bodyRule = bodyMatch![1];

      // Fallback first, then modern value
      expect(bodyRule).toContain('min-height: 100vh');
      expect(bodyRule).toContain('min-height: 100dvh');
    });

    it('should have #app-background with inset: 0 and no top/left/width/height', () => {
      const css = readFile('../styles.css');
      const ruleMatch = css.match(/#app-background\s*\{([^}]*)\}/s);
      expect(ruleMatch).toBeTruthy();
      const rule = ruleMatch![1];

      expect(rule).toContain('inset: 0');
      expect(rule).not.toContain('top: 0');
      expect(rule).not.toContain('left: 0');
      expect(rule).not.toContain('width: 100%');
      expect(rule).not.toContain('height: 100%');
    });

    it('should have body:after with inset: 0 and no top/left/width/height', () => {
      const css = readFile('../styles.css');
      const ruleMatch = css.match(/body:after\s*\{([^}]*)\}/s);
      expect(ruleMatch).toBeTruthy();
      const rule = ruleMatch![1];

      expect(rule).toContain('inset: 0');
      expect(rule).not.toContain('top: 0');
      expect(rule).not.toContain('left: 0');
      expect(rule).not.toContain('width: 100%');
      expect(rule).not.toContain('height: 100%');
    });
  });
});
