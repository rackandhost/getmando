import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();

async function readRepositoryFile(relativePath: string) {
  return fs.readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

async function readRepositoryJson<T>(relativePath: string) {
  return JSON.parse(await readRepositoryFile(relativePath)) as T;
}

type PackageJson = {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type AngularWorkspace = {
  projects?: {
    getmando?: {
      architect?: {
        lint?: {
          builder?: string;
          options?: {
            eslintConfig?: string;
            lintFilePatterns?: string[];
          };
        };
      };
    };
  };
};

describe('repository tooling setup', () => {
  it('defines eslint, scoped prettier, and husky tooling', async () => {
    const packageJson = await readRepositoryJson<PackageJson>('package.json');

    expect(packageJson.scripts).toMatchObject({
      lint: 'ng lint',
      format: 'prettier --write "src/**/*.{ts,html,scss}"',
      'format:check': 'prettier --check "src/**/*.{ts,html,scss}"',
      prepare: 'husky',
    });
    expect(packageJson.devDependencies).toMatchObject({
      '@angular-eslint/builder': expect.any(String),
      '@eslint/js': expect.any(String),
      'angular-eslint': expect.any(String),
      eslint: expect.any(String),
      husky: expect.any(String),
      'lint-staged': expect.any(String),
      prettier: expect.any(String),
      'typescript-eslint': expect.any(String),
    });
  });

  it('does not configure a repository-wide prettier baseline', async () => {
    await expect(fs.access(path.join(repositoryRoot, '.prettierignore'))).rejects.toThrow();
  });

  it('lints staged TypeScript and formats only staged source files', async () => {
    const packageJson = await readRepositoryJson<
      PackageJson & { 'lint-staged'?: Record<string, string | string[]> }
    >('package.json');

    expect(packageJson['lint-staged']).toEqual({
      'src/**/*.ts': ['eslint --fix', 'prettier --write'],
      'src/**/*.{html,scss}': 'prettier --write',
      'test-setup.ts': 'eslint --fix',
    });
  });

  it('adds an Angular lint target backed by the flat eslint config', async () => {
    const workspace = await readRepositoryJson<AngularWorkspace>('angular.json');
    const lintTarget = workspace.projects?.getmando?.architect?.lint;

    expect(lintTarget).toEqual({
      builder: '@angular-eslint/builder:lint',
      options: {
        eslintConfig: 'eslint.config.js',
        lintFilePatterns: ['src/**/*.ts', 'test-setup.ts'],
      },
    });
  });

  it('wires pull request CI to run eslint and scoped formatting before tests and a production build', async () => {
    const workflow = await readRepositoryFile('.github/workflows/test.yml');

    expect(workflow).toContain('- name: Run lint');
    expect(workflow).toContain('run: npm run lint');
    expect(workflow).toContain('- name: Check source formatting');
    expect(workflow).toContain('run: npm run format:check');
    expect(workflow.indexOf('- name: Run lint')).toBeLessThan(
      workflow.indexOf('- name: Run tests'),
    );
    expect(workflow.indexOf('- name: Check source formatting')).toBeLessThan(
      workflow.indexOf('- name: Run tests'),
    );
    expect(workflow).toContain('- name: Build production application');
    expect(workflow).toContain('run: npm run build -- --configuration production');
    expect(workflow.indexOf('- name: Build production application')).toBeGreaterThan(
      workflow.indexOf('- name: Run tests'),
    );
  });

  it('creates a husky pre-commit hook that runs lint-staged', async () => {
    const preCommitHook = await readRepositoryFile('.husky/pre-commit');

    expect(preCommitHook).toContain('npm exec lint-staged');
  });

  it('creates the flat eslint config needed by the Angular lint target', async () => {
    const eslintConfig = await readRepositoryFile('eslint.config.js');

    expect(eslintConfig).toContain("const angular = require('angular-eslint');");
    expect(eslintConfig).not.toContain('angular.processInlineTemplates');
    expect(eslintConfig).not.toContain("files: ['src/**/*.html']");
  });
});
