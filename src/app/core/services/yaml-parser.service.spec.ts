import { TestBed } from '@angular/core/testing';

import { DEFAULT_DASHBOARD_CONFIG } from '../models/dashboard.models';

import { ParseResult, YamlParserService } from './yaml-parser.service';

describe('YamlParserService', () => {
  let service: YamlParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [YamlParserService],
    });

    service = TestBed.inject(YamlParserService);
  });

  describe('parseYaml', () => {
    it.each(['', 'null', 'plain text'])(
      'rejects empty or non-object YAML content: %j',
      (yamlContent) => {
        const result = service.parseYaml(yamlContent);

        expect(result.success).toBe(false);
        expect(result.errors?.[0]).toEqual({
          path: [],
          message: 'YAML content is empty or invalid',
        });
      },
    );

    it('reports malformed YAML without throwing', () => {
      const result = service.parseYaml('metadata: [unterminated');

      expect(result.success).toBe(false);
      expect(result.errors?.[0]?.path).toEqual([]);
      expect(result.errors?.[0]?.message).toContain('unexpected end of the stream');
    });

    it('returns schema validation paths, messages, and codes', () => {
      const result = service.parseYaml('metadata: {}');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['metadata', 'title'], code: 'invalid_type' }),
          expect.objectContaining({ path: ['applications'], code: 'invalid_type' }),
        ]),
      );
    });

    it('should default favorite to false when not provided in YAML', () => {
      const yamlWithoutFavorite = `
metadata:
  title: 'Test'
  description: 'Test dashboard'

categories:
  - id: 'media'
    name: 'Media'

applications:
  - id: 'plex'
    name: 'Plex'
    description: 'Media server'
    url: 'https://plex.example.com'
    icon:
      type: 'name'
      value: 'plex'
    category: 'media'
    openNewTab: true
    tags:
      - media

bookmarks: []

settings:
  dateFormat: 'd MMMM yyyy'
  datePosition: 'bottom'
  showSeconds: false
  showDate: true
  itemsPerRow: 5
  allowBookmarks: true
  showAllCategory: true
  showDescriptions: true
  showLabels: true
  searchEngines:
    - 'google'
`;

      const result = service.parseYaml(yamlWithoutFavorite);

      expect(result.success).toBe(true);
      expect(result.data!.applications[0].favorite).toBe(false);
    });

    it('should parse favorite as true when provided in YAML', () => {
      const yamlWithFavorite = `
metadata:
  title: 'Test'
  description: 'Test dashboard'

categories:
  - id: 'media'
    name: 'Media'

applications:
  - id: 'plex'
    name: 'Plex'
    description: 'Media server'
    url: 'https://plex.example.com'
    icon:
      type: 'name'
      value: 'plex'
    category: 'media'
    openNewTab: true
    favorite: true
    tags:
      - media

bookmarks: []

settings:
  dateFormat: 'd MMMM yyyy'
  datePosition: 'bottom'
  showSeconds: false
  showDate: true
  itemsPerRow: 5
  allowBookmarks: true
  showAllCategory: true
  showDescriptions: true
  showLabels: true
  searchEngines:
    - 'google'
`;

      const result = service.parseYaml(yamlWithFavorite);

      expect(result.success).toBe(true);
      expect(result.data!.applications[0].favorite).toBe(true);
    });
  });

  it('throws a formatted validation error from parseYamlOrThrow', () => {
    expect(() => service.parseYamlOrThrow('metadata: {}')).toThrow(
      /Failed to parse YAML:\nmetadata\.title:/,
    );
  });

  it('reports validity through the same parse contract', () => {
    expect(service.isValidYaml('metadata: {}')).toBe(false);
    expect(service.isValidYaml('metadata: [unterminated')).toBe(false);
  });

  it('returns independent default configuration clones', () => {
    const first = service.getDefaultConfig();
    const second = service.getDefaultConfig();

    first.metadata.title = 'Changed';
    first.categories.push({ id: 'extra', name: 'Extra' });

    expect(second).toEqual(DEFAULT_DASHBOARD_CONFIG);
    expect(second).not.toBe(first);
    expect(second.metadata).not.toBe(first.metadata);
  });

  it('formats successful, detailed, and missing errors', () => {
    expect(service.formatErrorMessage({ success: true })).toBe('No errors');
    expect(
      service.formatErrorMessage({
        success: false,
        errors: [{ path: ['settings', 'theme'], message: 'Invalid option', code: 'invalid_value' }],
      }),
    ).toBe('YAML Validation Failed:\n  - settings.theme: Invalid option (invalid_value)');
    expect(service.formatErrorMessage({ success: false } as ParseResult)).toBe(
      'YAML Validation Failed:\n  - Unknown error',
    );
  });
});
