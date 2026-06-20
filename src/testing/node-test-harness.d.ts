declare module 'node:child_process' {
  export function execFile(
    file: string,
    args: readonly string[],
    options: {
      cwd?: string;
      env?: Record<string, string | undefined>;
    },
    callback: (error: ExecFileError | null, stdout: string, stderr: string) => void,
  ): void;

  export interface ExecFileError extends Error {
    code?: number | string;
    stdout?: string;
    stderr?: string;
  }
}

declare module 'node:fs/promises' {
  export function writeFile(path: string, data: string): Promise<void>;
  export function rm(path: string, options?: { force?: boolean }): Promise<void>;
}

declare module 'node:path' {
  const path: {
    join: (...parts: string[]) => string;
  };

  export default path;
}

declare const process: {
  cwd(): string;
  execPath: string;
  env: Record<string, string | undefined>;
};
