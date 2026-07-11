import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';

import { YamlLoaderService } from './yaml-loader.service';
import { YamlParserService } from './yaml-parser.service';
import { LoggerService } from './logger.service';

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

    TestBed.configureTestingModule({
      providers: [
        YamlLoaderService,
        { provide: HttpClient, useValue: httpClient },
        { provide: YamlParserService, useValue: yamlParser },
        { provide: LoggerService, useValue: logger },
      ],
    });

    service = TestBed.inject(YamlLoaderService);
  });

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

    expect(logger.debug).toHaveBeenCalledWith('[YamlLoader] YAML content loaded successfully');
    expect(logger.info).toHaveBeenCalledWith('[YamlLoader] Dashboard config loaded:', {
      title: config.metadata.title,
      apps: config.applications.length,
      categories: config.categories.length,
    });
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should log error and warn before falling back to default config', async () => {
    const loadError = new Error('missing dashboard.yaml');

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
  });
});
