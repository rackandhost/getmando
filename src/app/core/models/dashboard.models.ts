import { z } from 'zod';

/**
 * Icon configuration schema
 */
export const IconConfigSchema = z.object({
  type: z.enum(['url', 'name', 'initials']),
  value: z.string(),
});

/**
 * Application schema
 */
export const SelfhostedAppSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(255),
  url: z.string().url(),
  icon: IconConfigSchema,
  category: z.string(),
  openNewTab: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});

/**
 * Category schema
 */
export const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50),
});

/**
 * Bookmark schema
 */
export const BookmarkSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(255),
  url: z.string().url(),
  icon: IconConfigSchema,
  openNewTab: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});

/**
 * Search Engine schema
 */
export const SearchEngineSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50),
  searchUrl: z.string().url(),
  icon: z.string().optional(),
});

/**
 * Metadata schema
 */
export const DashboardMetadataSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(255),
});

/**
 * Settings schema
 */
export const DashboardSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  dateFormat: z.string().default('dd-MM-yyyy'),
  itemsPerRow: z.number().int().min(1).max(10).default(4),
  allowBookmarks: z.boolean().default(false),
  showAllCategory: z.boolean().default(true),
  showDescriptions: z.boolean().default(true),
  showLabels: z.boolean().default(true),
});

/**
 * Complete Dashboard configuration schema
 */
export const DashboardConfigSchema = z.object({
  metadata: DashboardMetadataSchema,
  categories: z.array(CategorySchema).min(1),
  applications: z.array(SelfhostedAppSchema).min(1),
  bookmarks: z.array(BookmarkSchema),
  searchEngines: z.array(SearchEngineSchema).min(1),
  settings: DashboardSettingsSchema,
});

/**
 * Type inference from schemas
 */
export type IconConfig = z.infer<typeof IconConfigSchema>;
export type SelfhostedApp = z.infer<typeof SelfhostedAppSchema>;
export type Bookmark = z.infer<typeof BookmarkSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type SearchEngine = z.infer<typeof SearchEngineSchema>;
export type DashboardMetadata = z.infer<typeof DashboardMetadataSchema>;
export type DashboardSettings = z.infer<typeof DashboardSettingsSchema>;
export type DashboardConfig = z.infer<typeof DashboardConfigSchema>;

/**
 * Default configuration
 */
export const APP_CATEGORY: Category = {
  id: 'apps',
  name: 'Apps',
};

export const BOOKMARKS_CATEGORY: Category = {
  id: 'bookmarks',
  name: 'Bookmarks',
};

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  metadata: {
    title: 'Mando',
    description: 'My Selfhosted Applications',
  },
  categories: [APP_CATEGORY],
  applications: [],
  bookmarks: [],
  searchEngines: [
    {
      id: 'google',
      name: 'Google',
      searchUrl: 'https://www.google.com/search?q={query}',
      icon: 'google',
    },
  ],
  settings: {
    theme: 'auto',
    dateFormat: 'dd-MM-yyyy',
    itemsPerRow: 4,
    allowBookmarks: false,
    showAllCategory: true,
    showDescriptions: true,
    showLabels: true,
  },
};
