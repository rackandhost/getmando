import * as fsp from 'node:fs/promises';

function isEnoent(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

/**
 * Writes `content` to `targetPath` atomically: the previous contents (if any) are copied to
 * `targetPath.bak` before the swap, and the new content lands via write-to-temp + rename so a
 * failure at any step never leaves `targetPath` truncated or partially written.
 */
export async function writeConfigAtomically(targetPath: string, content: string): Promise<void> {
  const tmpPath = `${targetPath}.tmp`;
  const backupPath = `${targetPath}.bak`;

  const handle = await fsp.open(tmpPath, 'w');
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    await fsp.copyFile(targetPath, backupPath);
  } catch (error) {
    if (!isEnoent(error)) {
      await fsp.unlink(tmpPath).catch(() => undefined);
      throw error;
    }
  }

  try {
    await fsp.rename(tmpPath, targetPath);
  } catch (error) {
    await fsp.unlink(tmpPath).catch(() => undefined);
    throw error;
  }
}
