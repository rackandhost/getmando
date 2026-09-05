import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

export interface StatusCheckResult {
  status: 'up' | 'down';
}

/**
 * Checks whether anything at `url` answers with an HTTP response. Any status code (2xx–5xx)
 * counts as up — many self-hosted apps redirect to a login or return 401/500 while healthy;
 * only a network-level failure (refused/reset/DNS) or a timeout counts as down.
 *
 * TLS verification is disabled for this one request only: a status dot answers "is something
 * listening", not "does this app have a browser-trusted certificate".
 */
export function checkAppStatus(url: string, timeoutMs: number): Promise<StatusCheckResult> {
  return new Promise((resolve) => {
    const transport = new URL(url).protocol === 'https:' ? httpsRequest : httpRequest;

    const request = transport(
      url,
      { timeout: timeoutMs, rejectUnauthorized: false },
      (response) => {
        // Headers arrived — the app is up. The body is never read; destroy the socket at once.
        response.destroy();
        resolve({ status: 'up' });
      },
    );

    request.on('timeout', () => {
      request.destroy();
      resolve({ status: 'down' });
    });

    request.on('error', () => {
      resolve({ status: 'down' });
    });

    request.end();
  });
}
