import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { DEFAULT_DASHBOARD_CONFIG } from '../models/dashboard.models';

import { ConfigWriteService } from './config-write.service';

describe('ConfigWriteService', () => {
  let service: ConfigWriteService;
  let httpClient: { post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    httpClient = { post: vi.fn() };

    TestBed.configureTestingModule({
      providers: [ConfigWriteService, { provide: HttpClient, useValue: httpClient }],
    });

    service = TestBed.inject(ConfigWriteService);
  });

  it('reports no token until one is set', () => {
    expect(service.hasToken()).toBe(false);

    service.setToken('shared-secret');

    expect(service.hasToken()).toBe(true);
  });

  it('does not call the API and reports unauthorized when no token is set', async () => {
    const result = await firstValueFrom(service.save(DEFAULT_DASHBOARD_CONFIG));

    expect(result).toEqual({ status: 'unauthorized', message: expect.any(String) });
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it('POSTs the config with the stored token in the X-Config-Token header', async () => {
    service.setToken('shared-secret');
    httpClient.post.mockReturnValue(of({ status: 'saved' }));

    await firstValueFrom(service.save(DEFAULT_DASHBOARD_CONFIG));

    expect(httpClient.post).toHaveBeenCalledWith('/api/config', DEFAULT_DASHBOARD_CONFIG, {
      headers: { 'X-Config-Token': 'shared-secret' },
    });
  });

  it('maps a successful response to saved', async () => {
    service.setToken('shared-secret');
    httpClient.post.mockReturnValue(of({ status: 'saved' }));

    await expect(firstValueFrom(service.save(DEFAULT_DASHBOARD_CONFIG))).resolves.toEqual({
      status: 'saved',
    });
  });

  it('maps a 400 response to invalid with the server-reported errors', async () => {
    service.setToken('shared-secret');
    const errors = [{ path: ['applications', '0', 'category'], message: "Category 'x' missing." }];
    httpClient.post.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 400, error: { status: 'invalid', errors } }),
      ),
    );

    await expect(firstValueFrom(service.save(DEFAULT_DASHBOARD_CONFIG))).resolves.toEqual({
      status: 'invalid',
      errors,
    });
  });

  it('maps a 401 response to unauthorized and clears the stored token', async () => {
    service.setToken('stale-secret');
    httpClient.post.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, error: { status: 'unauthorized' } })),
    );

    const result = await firstValueFrom(service.save(DEFAULT_DASHBOARD_CONFIG));

    expect(result).toEqual({ status: 'unauthorized', message: expect.any(String) });
    expect(service.hasToken()).toBe(false);
  });

  it('maps a 500 response to error with the server-reported message', async () => {
    service.setToken('shared-secret');
    httpClient.post.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: { status: 'error', message: 'Disk full.' },
          }),
      ),
    );

    await expect(firstValueFrom(service.save(DEFAULT_DASHBOARD_CONFIG))).resolves.toEqual({
      status: 'error',
      message: 'Disk full.',
    });
  });

  it('maps a network failure (no HTTP response) to a generic error', async () => {
    service.setToken('shared-secret');
    httpClient.post.mockReturnValue(throwError(() => new ProgressEvent('error')));

    await expect(firstValueFrom(service.save(DEFAULT_DASHBOARD_CONFIG))).resolves.toEqual({
      status: 'error',
      message: expect.any(String),
    });
  });
});
