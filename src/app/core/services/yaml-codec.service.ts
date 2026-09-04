import { Injectable, inject } from '@angular/core';
import * as yaml from 'js-yaml';

import { DashboardConfig, DashboardConfigSchema } from '../models/dashboard.models';

import { ParseError, YamlParserService } from './yaml-parser.service';

export type ConfigValidationResult =
  | { readonly success: true; readonly config: DashboardConfig }
  | { readonly success: false; readonly errors: readonly ParseError[] };

/** Omits blank background image overrides so a loaded YAML falls back to the built-in default. */
type CanonicalSettings = Omit<
  DashboardConfig['settings'],
  'lightBackgroundImage' | 'darkBackgroundImage'
> & {
  lightBackgroundImage?: string;
  darkBackgroundImage?: string;
};
type CanonicalDashboardConfig = Omit<DashboardConfig, 'settings'> & { settings: CanonicalSettings };

/** Parses dashboard YAML and emits normalized dashboard YAML for browser-only export. */
@Injectable({ providedIn: 'root' })
export class YamlCodecService {
  private readonly yamlParser = inject(YamlParserService);

  parse(content: string): ConfigValidationResult {
    const result = this.yamlParser.parseYaml(content);
    return result.success
      ? { success: true, config: result.data! }
      : { success: false, errors: result.errors ?? [] };
  }

  serialize(config: DashboardConfig): string {
    const validConfig = DashboardConfigSchema.parse(config);
    return yaml.dump(this.toCanonicalObject(validConfig), {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    });
  }

  private toCanonicalObject(config: DashboardConfig): CanonicalDashboardConfig {
    const { lightBackgroundImage, darkBackgroundImage, searchEngines, ...restSettings } =
      config.settings;

    return {
      metadata: { title: config.metadata.title, description: config.metadata.description },
      categories: config.categories.map(({ id, name }) => ({ id, name })),
      applications: config.applications.map((application) => ({
        id: application.id,
        name: application.name,
        description: application.description,
        url: application.url,
        icon: { type: application.icon.type, value: application.icon.value },
        category: application.category,
        openNewTab: application.openNewTab,
        tags: [...application.tags],
        favorite: application.favorite,
      })),
      bookmarks: config.bookmarks.map((bookmark) => ({
        id: bookmark.id,
        name: bookmark.name,
        description: bookmark.description,
        url: bookmark.url,
        icon: { type: bookmark.icon.type, value: bookmark.icon.value },
        openNewTab: bookmark.openNewTab,
        tags: [...bookmark.tags],
      })),
      settings: {
        ...restSettings,
        searchEngines: [...searchEngines],
        ...(lightBackgroundImage.trim() ? { lightBackgroundImage } : {}),
        ...(darkBackgroundImage.trim() ? { darkBackgroundImage } : {}),
      },
    };
  }
}
