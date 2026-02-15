import { Injectable, inject } from '@angular/core';
import * as yaml from 'js-yaml';

import {
  DashboardConfig,
  DashboardConfigSchema,
  DEFAULT_DASHBOARD_CONFIG,
} from '../models/dashboard.models';

/**
 * Parse error details
 */
export interface ParseError {
  path: string[];
  message: string;
  code?: string;
}

/**
 * Parse result
 */
export interface ParseResult {
  success: boolean;
  data?: DashboardConfig;
  errors?: ParseError[];
}

/**
 * Service for parsing and validating YAML configuration files
 * Uses js-yaml for parsing and Zod for schema validation
 */
@Injectable({ providedIn: 'root' })
export class YamlParserService {
  /**
   * Parse YAML string and validate against schema
   * @param yamlString - YAML content as string
   * @returns ParseResult with validated data or errors
   */
  parseYaml(yamlString: string): ParseResult {
    try {
      // Parse YAML to object
      const parsedYaml = yaml.load(yamlString);

      if (!parsedYaml || typeof parsedYaml !== 'object') {
        return {
          success: false,
          errors: [{ path: [], message: 'YAML content is empty or invalid' }],
        };
      }

      // Validate against Zod schema
      const validationResult = DashboardConfigSchema.safeParse(parsedYaml);

      if (validationResult.success) {
        return {
          success: true,
          data: validationResult.data,
        };
      }

      // Format Zod errors
      const errors: ParseError[] = validationResult.error.issues.map((issue) => ({
        path: issue.path.map((p) => String(p)),
        message: issue.message,
        code: issue.code,
      }));

      return {
        success: false,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            path: [],
            message: error instanceof Error ? error.message : 'Unknown parsing error',
          },
        ],
      };
    }
  }

  /**
   * Parse YAML string and throw on error (for use in contexts where errors should propagate)
   * @param yamlString - YAML content as string
   * @returns Validated DashboardConfig
   * @throws Error if parsing or validation fails
   */
  parseYamlOrThrow(yamlString: string): DashboardConfig {
    const result = this.parseYaml(yamlString);

    if (!result.success) {
      const errorMessage =
        result.errors?.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n') ||
        'Unknown error';
      throw new Error(`Failed to parse YAML:\n${errorMessage}`);
    }

    return result.data!;
  }

  /**
   * Get default configuration as fallback
   * @returns Default DashboardConfig
   */
  getDefaultConfig(): DashboardConfig {
    return JSON.parse(JSON.stringify(DEFAULT_DASHBOARD_CONFIG));
  }

  /**
   * Check if a YAML string is valid without returning data
   * @param yamlString - YAML content as string
   * @returns true if valid, false otherwise
   */
  isValidYaml(yamlString: string): boolean {
    return this.parseYaml(yamlString).success;
  }

  /**
   * Get formatted error message from parse result
   * @param result - ParseResult from parseYaml
   * @returns Human-readable error message
   */
  formatErrorMessage(result: ParseResult): string {
    if (result.success) {
      return 'No errors';
    }

    const messages = result.errors?.map((error) => {
      const pathStr = error.path.length > 0 ? error.path.join('.') : 'root';
      return `  - ${pathStr}: ${error.message}${error.code ? ` (${error.code})` : ''}`;
    }) || ['  - Unknown error'];

    return `YAML Validation Failed:\n${messages.join('\n')}`;
  }
}
