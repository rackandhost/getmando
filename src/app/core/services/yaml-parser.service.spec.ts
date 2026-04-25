import {TestBed} from '@angular/core/testing';

import {YamlParserService} from './yaml-parser.service';

describe('YamlParserService', () => {
  let service: YamlParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [YamlParserService],
    });

    service = TestBed.inject(YamlParserService);
  });

  describe('parseYaml', () => {
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
});
