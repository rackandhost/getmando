import { describe, expect, it } from 'vitest';

import {
  collectFocusedTestViolations,
  isTestFilePath,
} from './check-focused-tests.mjs';

describe('isTestFilePath', () => {
  it('matches common repository test file names', () => {
    expect(isTestFilePath('src/app/app.component.spec.ts')).toBe(true);
    expect(isTestFilePath('scripts/check-focused-tests.test.mjs')).toBe(true);
  });

  it('ignores non-test files', () => {
    expect(isTestFilePath('README.md')).toBe(false);
    expect(isTestFilePath('src/app/app.component.ts')).toBe(false);
  });
});

describe('collectFocusedTestViolations', () => {
  it('detects .only, fit, and fdescribe usage in test files', () => {
    const violations = collectFocusedTestViolations([
      {
        path: 'src/app/example.component.spec.ts',
        content: [
          "describe.only('component', () => {});",
          "fit('runs one spec', () => {});",
          "fdescribe('suite', () => {});",
        ].join('\n'),
      },
    ]);

    expect(violations).toEqual([
      {
        filePath: 'src/app/example.component.spec.ts',
        line: 1,
        pattern: '.only',
      },
      {
        filePath: 'src/app/example.component.spec.ts',
        line: 2,
        pattern: 'fit',
      },
      {
        filePath: 'src/app/example.component.spec.ts',
        line: 3,
        pattern: 'fdescribe',
      },
    ]);
  });

  it('detects newline-separated .only usage and reports the .only line', () => {
    const violations = collectFocusedTestViolations([
      {
        path: 'src/app/example.component.spec.ts',
        content: ["describe", "  .only('component', () => {});"] .join('\n'),
      },
    ]);

    expect(violations).toEqual([
      {
        filePath: 'src/app/example.component.spec.ts',
        line: 2,
        pattern: '.only',
      },
    ]);
  });

  it('ignores normal tests, comments, and non-test files', () => {
    const violations = collectFocusedTestViolations([
      {
        path: 'src/app/example.component.spec.ts',
        content: [
          "describe('component', () => {});",
          "it('runs one spec', () => {});",
          "// describe.only('commented', () => {});",
          "/* fit('commented block', () => {}); */",
          'const example = "describe.only(local only)";',
        ].join('\n'),
      },
      {
        path: 'README.md',
        content: "Use describe.only locally when debugging.",
      },
    ]);

    expect(violations).toEqual([]);
  });

  it('preserves line numbers after multiline block comments', () => {
    const violations = collectFocusedTestViolations([
      {
        path: 'src/app/example.component.spec.ts',
        content: [
          '/*',
          "describe.only('commented', () => {});",
          '*/',
          '',
          "fit('runs one spec', () => {});",
        ].join('\n'),
      },
    ]);

    expect(violations).toEqual([
      {
        filePath: 'src/app/example.component.spec.ts',
        line: 5,
        pattern: 'fit',
      },
    ]);
  });
});
