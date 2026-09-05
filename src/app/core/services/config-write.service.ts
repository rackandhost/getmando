import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { DashboardConfig } from '../models/dashboard.models';

import { ParseError } from './yaml-parser.service';

export type ConfigWriteResult =
  | { readonly status: 'saved' }
  | { readonly status: 'invalid'; readonly errors: readonly ParseError[] }
  | { readonly status: 'unauthorized' | 'error'; readonly message: string };

const TOKEN_STORAGE_KEY = 'config-write-token';
const CONFIG_WRITE_URL = '/api/config';
const TOKEN_HEADER = 'X-Config-Token';

/**
 * POSTs the configurator draft to the write-api sidecar. The shared-secret token has no
 * server-side session to live in, so it's entered once client-side and kept in localStorage; a
 * 401 clears it so the next save prompts for it again (see design.md § Decisions/Auth).
 */
@Injectable({ providedIn: 'root' })
export class ConfigWriteService {
  private readonly http = inject(HttpClient);

  hasToken(): boolean {
    return this.readToken() !== null;
  }

  setToken(token: string): void {
    this.writeStorage(() => localStorage.setItem(TOKEN_STORAGE_KEY, token));
  }

  save(config: DashboardConfig): Observable<ConfigWriteResult> {
    const token = this.readToken();
    if (!token) {
      return of({ status: 'unauthorized', message: 'No write token is set.' });
    }

    return this.http.post(CONFIG_WRITE_URL, config, { headers: { [TOKEN_HEADER]: token } }).pipe(
      map((): ConfigWriteResult => ({ status: 'saved' })),
      catchError((error: unknown) => of(this.toResult(error))),
    );
  }

  private toResult(error: unknown): ConfigWriteResult {
    if (!(error instanceof HttpErrorResponse)) {
      return { status: 'error', message: 'Unable to reach the write endpoint.' };
    }

    if (error.status === 401) {
      this.clearToken();
      return { status: 'unauthorized', message: 'The write token was rejected.' };
    }

    if (error.status === 400 && Array.isArray(error.error?.errors)) {
      return { status: 'invalid', errors: error.error.errors };
    }

    return {
      status: 'error',
      message:
        typeof error.error?.message === 'string'
          ? error.error.message
          : 'Unable to save to the server.',
    };
  }

  private clearToken(): void {
    this.writeStorage(() => localStorage.removeItem(TOKEN_STORAGE_KEY));
  }

  private readToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  /** Storage can throw (private browsing, disabled storage) — a failed save then just re-prompts. */
  private writeStorage(write: () => void): void {
    try {
      write();
    } catch {
      // See above.
    }
  }
}
