import { mkdtemp, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeConfigAtomically } from './write-config';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    open: vi.fn(actual.open),
    rename: vi.fn(actual.rename),
  };
});

describe('writeConfigAtomically', () => {
  let dir: string;
  let targetPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'config-write-api-'));
    targetPath = join(dir, 'dashboard.yaml');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates the target file when none exists yet, without a backup', async () => {
    await writeConfigAtomically(targetPath, 'metadata:\n  title: Mando\n');

    await expect(readFile(targetPath, 'utf8')).resolves.toBe('metadata:\n  title: Mando\n');
    await expect(readFile(`${targetPath}.bak`, 'utf8')).rejects.toThrow(/ENOENT/);
  });

  it('overwrites the target and rotates the previous contents into .bak', async () => {
    await writeFile(targetPath, 'metadata:\n  title: Old\n', 'utf8');

    await writeConfigAtomically(targetPath, 'metadata:\n  title: New\n');

    await expect(readFile(targetPath, 'utf8')).resolves.toBe('metadata:\n  title: New\n');
    await expect(readFile(`${targetPath}.bak`, 'utf8')).resolves.toBe('metadata:\n  title: Old\n');
  });

  it('leaves the original file untouched when the tmp-file write fails', async () => {
    await writeFile(targetPath, 'metadata:\n  title: Old\n', 'utf8');

    vi.mocked(open).mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));

    await expect(writeConfigAtomically(targetPath, 'metadata:\n  title: New\n')).rejects.toThrow(
      /ENOSPC/,
    );

    await expect(readFile(targetPath, 'utf8')).resolves.toBe('metadata:\n  title: Old\n');
    await expect(readFile(`${targetPath}.bak`, 'utf8')).rejects.toThrow(/ENOENT/);
  });

  it('leaves the original file untouched and cleans up the tmp file when rename fails', async () => {
    await writeFile(targetPath, 'metadata:\n  title: Old\n', 'utf8');

    vi.mocked(rename).mockRejectedValueOnce(new Error('EACCES: permission denied'));

    await expect(writeConfigAtomically(targetPath, 'metadata:\n  title: New\n')).rejects.toThrow(
      /EACCES/,
    );

    await expect(readFile(targetPath, 'utf8')).resolves.toBe('metadata:\n  title: Old\n');
    await expect(readFile(`${targetPath}.tmp`, 'utf8')).rejects.toThrow(/ENOENT/);
    // The backup step already ran before rename, so it should still reflect the pre-write contents.
    await expect(readFile(`${targetPath}.bak`, 'utf8')).resolves.toBe('metadata:\n  title: Old\n');
  });
});
