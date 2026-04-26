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
    it('should have html with min-height: 100dvh', () => {
      const css = readFile('../styles.css');
      const htmlMatch = css.match(/html\s*\{([^}]*)\}/s);
      expect(htmlMatch).toBeTruthy();
      const htmlRule = htmlMatch![1];

      expect(htmlRule).toContain('min-height: 100dvh');
    });

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

    it('should have #app-background with inset: 0 and safe-area negative margins', () => {
      const css = readFile('../styles.css');
      const ruleMatch = css.match(/#app-background\s*\{([^}]*)\}/s);
      expect(ruleMatch).toBeTruthy();
      const rule = ruleMatch![1];

      expect(rule).toContain('inset: 0');
      expect(rule).toContain('env(safe-area-inset-top');
      expect(rule).toContain('env(safe-area-inset-bottom');
    });

    it('should have body:after with inset: 0 and safe-area negative margins', () => {
      const css = readFile('../styles.css');
      const ruleMatch = css.match(/body:after\s*\{([^}]*)\}/s);
      expect(ruleMatch).toBeTruthy();
      const rule = ruleMatch![1];

      expect(rule).toContain('inset: 0');
      expect(rule).toContain('env(safe-area-inset-top');
      expect(rule).toContain('env(safe-area-inset-bottom');
    });
  });
});
