import { readFile } from 'node:fs/promises';

import { load } from 'js-yaml';

import { DashboardConfigSchema } from '../../src/app/core/models/dashboard.models';

import { checkAppStatus } from './status-checker';

export const DEFAULT_STATUS_CHECK_INTERVAL_MS = 60_000;
export const DEFAULT_CHECK_TIMEOUT_MS = 5_000;

export interface CachedAppStatus {
  status: 'up' | 'down';
  checkedAt: string;
}

export type StatusCheck = typeof checkAppStatus;

export interface StatusPollerOptions {
  configPath: string;
  check?: StatusCheck;
  checkTimeoutMs?: number;
}

export interface StatusPoller {
  /** Runs one cycle immediately, then re-reads and re-checks every `intervalMs`. */
  start(intervalMs: number): void;
  stop(): void;
  /** Snapshot of the latest results, keyed by app id. */
  getStatuses(): Record<string, CachedAppStatus>;
  getIntervalMs(): number;
}

/**
 * Re-reads `CONFIG_PATH` from disk every cycle (so edits made outside the write API are picked
 * up with no state to keep in sync), checks every `healthCheck: true` application in parallel,
 * and caches `{ status, checkedAt }` per app id in memory. A missing or invalid config file
 * keeps the previous cache and logs — a transient bad read never clears known statuses.
 */
export function createStatusPoller({
  configPath,
  check = checkAppStatus,
  checkTimeoutMs = DEFAULT_CHECK_TIMEOUT_MS,
}: StatusPollerOptions): StatusPoller {
  const cache = new Map<string, CachedAppStatus>();
  let intervalMs = DEFAULT_STATUS_CHECK_INTERVAL_MS;
  let timer: NodeJS.Timeout | undefined;

  async function runCycle(): Promise<void> {
    let applications;
    try {
      applications = DashboardConfigSchema.parse(load(await readFile(configPath, 'utf8'))).applications;
    } catch (error) {
      console.error(
        `[status-poller] could not read or parse ${configPath}; keeping previous statuses`,
        error,
      );
      return;
    }

    await Promise.all(
      applications
        .filter((application) => application.healthCheck)
        .map(async (application) => {
          const { status } = await check(application.url, checkTimeoutMs);
          cache.set(application.id, { status, checkedAt: new Date().toISOString() });
        }),
    );
  }

  return {
    start(startedIntervalMs: number): void {
      intervalMs = startedIntervalMs;
      void runCycle();
      timer = setInterval(() => void runCycle(), intervalMs);
    },

    stop(): void {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    },

    getStatuses(): Record<string, CachedAppStatus> {
      return Object.fromEntries(cache);
    },

    getIntervalMs(): number {
      return intervalMs;
    },
  };
}
