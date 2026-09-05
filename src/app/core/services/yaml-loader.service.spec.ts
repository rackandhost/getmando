import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { defer, firstValueFrom, of, throwError } from 'rxjs';

import { YamlLoaderService } from './yaml-loader.service';
import { YamlParserService } from './yaml-parser.service';
import { LoggerService } from './logger.service';
import { NotificationService } from './notification.service';

import { DEFAULT_DASHBOARD_CONFIG } from '../models/dashboard.models';

describe('YamlLoaderService', () => {
  let service: YamlLoaderService;
  let httpClient: { get: ReturnType<typeof vi.fn>; head: ReturnType<typeof vi.fn> };
  let yamlParser: {
    parseYamlOrThrow: ReturnType<typeof vi.fn>;
    getDefaultConfig: ReturnType<typeof vi.fn>;
  };
  let logger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let notifications: { warning: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpClient = {
      get: vi.fn(),
      head: vi.fn(),
    };
    yamlParser = {
      parseYamlOrThrow: vi.fn(),
      getDefaultConfig: vi.fn(() => DEFAULT_DASHBOARD_CONFIG),
    };
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    notifications = { warning: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        YamlLoaderService,
        { provide: HttpClient, useValue: httpClient },
        { provide: YamlParserService, useValue: yamlParser },
        { provide: LoggerService, useValue: logger },
        { provide: NotificationService, useValue: notifications },
      ],
    });

    service = TestBed.inject(YamlLoaderService);
  });

  afterEach(() => vi.useRealTimers());

  it('should log debug and info on successful config load', async () => {
    const config = {
      ...DEFAULT_DASHBOARD_CONFIG,
      applications: [
        {
          id: 'plex',
          name: 'Plex',
          description: 'Media server',
          url: 'https://plex.example.com',
          icon: { type: 'name', value: 'plex' },
          category: 'apps',
          openNewTab: true,
          tags: [],
          favorite: false,
        },
      ],
    };

    httpClient.get.mockReturnValue(of('yaml-content'));
    yamlParser.parseYamlOrThrow.mockReturnValue(config);

    await expect(firstValueFrom(service.loadDashboardConfig())).resolves.toEqual(config);

    expect(httpClient.get).toHaveBeenCalledOnce();
    expect(logger.debug).toHaveBeenCalledWith('[YamlLoader] YAML content loaded successfully');
    expect(logger.info).toHaveBeenCalledWith('[YamlLoader] Dashboard config loaded:', {
      title: config.metadata.title,
      apps: config.applications.length,
      categories: config.categories.length,
    });
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('falls back immediately for a non-retryable HTTP error', async () => {
    vi.useFakeTimers();
    const loadError = new HttpErrorResponse({ status: 404 });

    httpClient.get.mockReturnValue(throwError(() => loadError));

    await expect(firstValueFrom(service.loadDashboardConfig())).resolves.toEqual(
      DEFAULT_DASHBOARD_CONFIG,
    );

    expect(logger.error).toHaveBeenCalledWith(
      '[YamlLoader] Failed to load dashboard config:',
      loadError,
    );
    expect(logger.warn).toHaveBeenCalledWith('[YamlLoader] Falling back to default configuration');
    expect(yamlParser.getDefaultConfig).toHaveBeenCalledOnce();
    expect(notifications.warning).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries transient HTTP failures after 250ms and 500ms before succeeding', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    httpClient.get.mockReturnValue(
      defer(() => {
        attempts++;
        return attempts < 3
          ? throwError(() => new HttpErrorResponse({ status: 503 }))
          : of('yaml-content');
      }),
    );
    yamlParser.parseYamlOrThrow.mockReturnValue(DEFAULT_DASHBOARD_CONFIG);

    const result = firstValueFrom(service.loadDashboardConfig());
    expect(attempts).toBe(1);
    await vi.advanceTimersByTimeAsync(249);
    expect(attempts).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(attempts).toBe(2);
    await vi.advanceTimersByTimeAsync(499);
    expect(attempts).toBe(2);
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toEqual(DEFAULT_DASHBOARD_CONFIG);
    expect(attempts).toBe(3);
    expect(notifications.warning).not.toHaveBeenCalled();
  });

  it('retries transient HTTP failures three times before one fallback', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    httpClient.get.mockReturnValue(
      defer(() => {
        attempts++;
        return throwError(() => new HttpErrorResponse({ status: 0 }));
      }),
    );

    const result = firstValueFrom(service.loadDashboardConfig());
    await vi.advanceTimersByTimeAsync(250 + 500 + 999);
    expect(attempts).toBe(3);
    expect(notifications.warning).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toEqual(DEFAULT_DASHBOARD_CONFIG);
    expect(attempts).toBe(4);
    expect(notifications.warning).toHaveBeenCalledOnce();
    expect(yamlParser.getDefaultConfig).toHaveBeenCalledOnce();
  });

  it.each([new Error('invalid YAML syntax'), new Error('invalid Zod schema')])(
    'does not retry parser failure: %s',
    async (parseError) => {
      httpClient.get.mockReturnValue(of('invalid-yaml'));
      yamlParser.parseYamlOrThrow.mockImplementation(() => {
        throw parseError;
      });

      await expect(firstValueFrom(service.loadDashboardConfig())).resolves.toEqual(
        DEFAULT_DASHBOARD_CONFIG,
      );

      expect(yamlParser.parseYamlOrThrow).toHaveBeenCalledWith('invalid-yaml');
      expect(logger.error).toHaveBeenCalledWith(
        '[YamlLoader] Failed to load dashboard config:',
        parseError,
      );
      expect(yamlParser.getDefaultConfig).toHaveBeenCalledOnce();
      expect(notifications.warning).toHaveBeenCalledOnce();
      expect(httpClient.get).toHaveBeenCalledOnce();
    },
  );

  it('reports whether the config resource exists', async () => {
    httpClient.head.mockReturnValueOnce(of(undefined));
    await expect(firstValueFrom(service.configExists())).resolves.toBe(true);

    httpClient.head.mockReturnValueOnce(throwError(() => new Error('not found')));
    await expect(firstValueFrom(service.configExists())).resolves.toBe(false);

    expect(httpClient.head).toHaveBeenCalledTimes(2);
    expect(httpClient.head).toHaveBeenCalledWith('/config/dashboard.yaml');
  });
});

describe('YamlLoaderService mounted configuration outcome', () => {
  let service: YamlLoaderService;
  let httpClient: { get: ReturnType<typeof vi.fn> };
  let yamlParser: { parseYamlOrThrow: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpClient = { get: vi.fn() };
    yamlParser = { parseYamlOrThrow: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        YamlLoaderService,
        { provide: HttpClient, useValue: httpClient },
        { provide: YamlParserService, useValue: yamlParser },
        {
          provide: LoggerService,
          useValue: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        },
        { provide: NotificationService, useValue: { warning: vi.fn() } },
      ],
    });
    service = TestBed.inject(YamlLoaderService);
  });
  it('retains a valid mounted configuration without a fallback', async () => {
    httpClient.get.mockReturnValue(of('yaml-content'));
    yamlParser.parseYamlOrThrow.mockReturnValue(DEFAULT_DASHBOARD_CONFIG);

    await expect(firstValueFrom(service.loadMountedConfig())).resolves.toEqual({
      status: 'valid',
      config: DEFAULT_DASHBOARD_CONFIG,
    });
    expect(service.mountedConfigResult()).toEqual({
      status: 'valid',
      config: DEFAULT_DASHBOARD_CONFIG,
    });
  });

  it('retains a missing outcome for a missing mounted file', async () => {
    httpClient.get.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    await expect(firstValueFrom(service.loadMountedConfig())).resolves.toEqual({
      status: 'missing',
    });
    expect(service.mountedConfigResult()).toEqual({ status: 'missing' });
  });

  it('retains an invalid outcome when mounted YAML cannot be parsed', async () => {
    yamlParser.parseYamlOrThrow.mockImplementation(() => {
      throw new Error('invalid YAML');
    });
    httpClient.get.mockReturnValue(of('invalid-content'));

    await expect(firstValueFrom(service.loadMountedConfig())).resolves.toEqual({
      status: 'invalid',
      errors: [{ path: [], message: 'invalid YAML' }],
    });
  });

  it('retains an unavailable outcome after non-missing request failure', async () => {
    httpClient.get.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

    await expect(firstValueFrom(service.loadMountedConfig())).resolves.toEqual({
      status: 'unavailable',
      message: 'The mounted configuration is unavailable.',
    });
  });

  it('re-fetches instead of replaying the cached mounted config on refresh', async () => {
    httpClient.get.mockReturnValueOnce(of('yaml-content-v1'));
    yamlParser.parseYamlOrThrow.mockReturnValueOnce({
      ...DEFAULT_DASHBOARD_CONFIG,
      metadata: { ...DEFAULT_DASHBOARD_CONFIG.metadata, title: 'v1' },
    });
    await expect(firstValueFrom(service.loadMountedConfig())).resolves.toMatchObject({
      config: { metadata: { title: 'v1' } },
    });

    httpClient.get.mockReturnValueOnce(of('yaml-content-v2'));
    yamlParser.parseYamlOrThrow.mockReturnValueOnce({
      ...DEFAULT_DASHBOARD_CONFIG,
      metadata: { ...DEFAULT_DASHBOARD_CONFIG.metadata, title: 'v2' },
    });

    await expect(firstValueFrom(service.refreshMountedConfig())).resolves.toMatchObject({
      config: { metadata: { title: 'v2' } },
    });
    expect(httpClient.get).toHaveBeenCalledTimes(2);
    expect(service.mountedConfigResult()).toMatchObject({ config: { metadata: { title: 'v2' } } });

    await expect(firstValueFrom(service.loadMountedConfig())).resolves.toMatchObject({
      config: { metadata: { title: 'v2' } },
    });
    expect(httpClient.get).toHaveBeenCalledTimes(2);
  });
});
