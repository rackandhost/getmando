import { execFile } from 'node:child_process';
import { writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const cliPath = path.join(repositoryRoot, 'scripts/check-focused-tests.mjs');
const temporaryViolationPath = path.join(
  repositoryRoot,
  'scripts/__focused-test-cli-regression__.test.mjs',
);

type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

async function runFocusedTestsCli() {
  return new Promise<CliResult>((resolve, reject) => {
    execFile(process.execPath, [cliPath], {
      cwd: repositoryRoot,
      env: process.env,
    }, (error, stdout, stderr) => {
      if (error && typeof error === 'object' && 'code' in error) {
        resolve({
          exitCode: Number(error.code),
          stdout,
          stderr,
        });
        return;
      }

      if (error) {
        reject(error);
        return;
      }

      resolve({
        exitCode: 0,
        stdout,
        stderr,
      });
    });
  });
}

describe('check-focused-tests CLI', () => {
  afterEach(async () => {
    await rm(temporaryViolationPath, { force: true });
  });

  it('exits successfully when the repository has no focused tests', async () => {
    const result = await runFocusedTestsCli();

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Focused test check passed.');
    expect(result.stderr).toBe('');
  });

  it('exits with a violation report when a committed focused test is present', async () => {
    await writeFile(temporaryViolationPath, "fit('temporary focused test', () => {});\n");

    const result = await runFocusedTestsCli();

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Focused test check failed. Remove committed focused tests:');
    expect(result.stderr).toContain('scripts/__focused-test-cli-regression__.test.mjs:1 (fit)');
  });

  it('reports focused .only.each chains as committed violations', async () => {
    await writeFile(
      temporaryViolationPath,
      "test.only.each([[1]])('temporary focused test %s', () => {});\n",
    );

    const result = await runFocusedTestsCli();

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Focused test check failed. Remove committed focused tests:');
    expect(result.stderr).toContain('scripts/__focused-test-cli-regression__.test.mjs:1 (.only)');
  });

  it('reports chained Vitest focus APIs as committed violations', async () => {
    await writeFile(
      temporaryViolationPath,
      "test.concurrent.only('temporary focused test', () => {});\n",
    );

    const result = await runFocusedTestsCli();

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Focused test check failed. Remove committed focused tests:');
    expect(result.stderr).toContain('scripts/__focused-test-cli-regression__.test.mjs:1 (.only)');
  });
});
