# Exploration: Favorites Feature

## Current State

getmando is an Angular 21 dashboard that renders self-hosted apps from a `dashboard.yaml` configuration. The data flow is:

1. `YamlParserService` parses YAML → `DashboardConfig` (Zod-validated)
2. `ConfigService` emits the config via `BehaviorSubject`
3. `CategoryService` derives visible categories: `[Apps (optional), Bookmarks (optional), ...user categories sorted A-Z]`
4. `AppService.apps$` merges `applications` + `bookmarks` (if `allowBookmarks`) into a flat list sorted by name
5. `AppService.filteredApps$` combines `apps$`, `searchQuery$`, `selectedCategory$` and calls `SearchService.filterApps`
6. `DashboardComponent` renders the grid; `AppCategoriesComponent` renders category tabs

There is **no concept of favorites** today. Categories are entirely driven by the `category` field on each app. Bookmarks are a separate entity without a `category` field (they get `BOOKMARKS_CATEGORY.id` injected at runtime).

## Affected Areas

| File | Why Affected |
|------|-------------|
| `src/app/core/models/dashboard.models.ts` | Add `favorite` to `SelfhostedAppSchema`; add `FAVORITES_CATEGORY` constant |
| `src/app/core/services/category.service.ts` | Dynamically prepend `FAVORITES_CATEGORY` when ≥1 favorite app exists |
| `src/app/core/services/app.service.ts` | Handle `FAVORITES_CATEGORY` in `getAppsByCategory`; fix `showAllCategory=false` auto-selection logic |
| `src/app/core/services/search.service.ts` | Handle `FAVORITES_CATEGORY` in `filterApps` |
| `src/app/shared/components/app-categories/app-categories.component.spec.ts` | Update mocks/tests if category list behavior changes |
| `src/app/views/dashboard/dashboard.component.spec.ts` | Update mocks if new category constant is referenced |
| `README.md` | Document the new `favorite` field in the applications reference table |

## Approaches

### Option A — Virtual Favorites Category (Recommended)

Treat "Favorites" as a derived, virtual category (exactly like "Apps" and "Bookmarks"). No schema changes beyond adding `favorite: boolean`. The category appears dynamically when at least one app is favorited.

**Changes:**
- `SelfhostedAppSchema`: add `favorite: z.boolean().default(false)`
- `dashboard.models.ts`: add `FAVORITES_CATEGORY: Category = {id: 'favorites', name: 'Favorites'}`
- `CategoryService.categories$`: if `applications.some(a => a.favorite)`, prepend `FAVORITES_CATEGORY`
- `SearchService.filterApps`: if `categoryId === FAVORITES_CATEGORY.id`, filter by `app.favorite === true`
- `AppService.getAppsByCategory`: same logic
- `AppService.apps$` tap: if `!showAllCategory`, select first visible category (not `config.categories[0]`). Derive this by checking if favorites exist.

**Pros:**
- Minimal footprint; follows existing virtual-category pattern (Apps, Bookmarks)
- No new settings needed
- Backward-compatible: existing configs without `favorite` default to `false`

**Cons:**
- Category order logic becomes slightly more complex
- Favorites category disappears/reappears dynamically as config changes

**Effort:** Low

### Option B — Settings-Gated Favorites

Add a `showFavorites: boolean` setting (default `true`). The Favorites category is only shown when this setting is enabled AND favorites exist.

**Pros:**
- Users can explicitly disable the feature
- More predictable behavior

**Cons:**
- Overkill for the requested feature
- Adds UI bloat (no settings panel exists today for per-feature toggles)
- Not what the user asked for

**Effort:** Medium

### Option C — Favorites as a Separate Data Structure

Store favorites as an array of IDs or a separate `favorites` section in the YAML, then cross-reference at runtime.

**Pros:**
- Keeps app schema smaller

**Cons:**
- Breaks the intuitive "per-app" configuration style
- More complex YAML authoring
- Requires validation that IDs exist

**Effort:** Medium

## Recommendation

**Option A — Virtual Favorites Category.**

It aligns perfectly with how "Apps" and "Bookmarks" are already implemented as virtual categories. The user's mental model ("each application supports `favorite: true/false`") maps directly to a boolean field on the app. The dynamic appearance of the category is acceptable because the config is loaded at startup; it won't flicker in normal use.

## Data Flow (Option A)

```
dashboard.yaml
  applications:
    - id: plex
      favorite: true
      ...

YamlParserService.parseYaml()
  → DashboardConfig.applications[0].favorite === true

ConfigService.config$
  → CategoryService.categories$
    → [FAVORITES_CATEGORY, APP_CATEGORY, ...user categories]  (favorites exist)
    → [APP_CATEGORY, ...user categories]                     (no favorites)

AppService.apps$
  → [all apps + bookmarks] sorted by name

AppService.filteredApps$
  → SearchService.filterApps(apps, query, categoryId)
    → if categoryId === 'favorites': apps.filter(a => a.favorite === true)
    → else: existing behavior
```

## UI/UX Considerations

1. **Category Order**: Favorites MUST appear **first** in the category list (before Apps). The rationale: favorites are the user's most-curated subset; they should be the most accessible.

2. **Dynamic Visibility**: The Favorites tab SHOULD only appear when at least one app is favorited. An empty Favorites category is confusing and wastes UI space.

3. **Default Selection When `showAllCategory: false`**: Currently, when `showAllCategory` is false, the app auto-selects `config.categories[0].id`. If favorites exist, the first visible category is now Favorites, so the auto-selection logic MUST be updated.

4. **Search Behavior**: During active search, categories are disabled and all apps are searched. Favorited apps MUST still appear in search results (they are part of the flat apps list). The `filterApps` method handles this correctly because `searchAll = true` bypasses category filtering.

5. **Empty State**: If the user selects Favorites and then removes all favorites from the YAML (or loads a config with no favorites), the Favorites tab disappears. Angular's change detection will re-render the category list. The dashboard will show the "No applications found" empty state if Favorites was the selected category and it disappears. To mitigate this, `CategoryService` or `AppService` should reset the selected category to the first remaining visible category when Favorites disappears.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No favorites in config | Favorites category is **hidden** entirely |
| `showAllCategory: false` + favorites exist | Auto-select **Favorites** (first visible category) |
| `showAllCategory: false` + no favorites | Auto-select first user-defined category (existing behavior) |
| Search active | Categories disabled; favorited apps appear in search normally |
| All favorites removed at runtime (config reload) | Favorites tab disappears; selected category SHOULD fall back to next visible category |
| Bookmarks | Bookmarks do **not** support `favorite` (out of scope; BookmarkSchema is separate) |
| Duplicate app names in favorites | Allowed; sorted alphabetically within Favorites like any other category |

## Accessibility Considerations

1. **Dynamic Category List**: When Favorites appears/disappears, screen readers SHOULD be informed. The existing `<nav aria-label="Categories">` with `@for` rendering is sufficient because Angular re-renders the full list; screen readers will detect DOM changes. However, we SHOULD ensure focus management doesn't break: if a user has focus on the Favorites button and it disappears, focus will be lost. This is an edge case (requires config reload while focused), but worth noting.

2. **ARIA Pressed State**: Category buttons already use `aria-pressed`. No change needed.

3. **Keyboard Navigation**: The category list is a `<nav>` containing `<button>` elements. Tab order is natural. No change needed.

4. **Color Contrast / Visual Distinction**: Consider whether Favorites should have a visual distinction (e.g., a star icon). This is a design decision for the `sdd-design` phase. At minimum, the text "Favorites" is sufficient for WCAG AA.

5. **Empty State Accessibility**: The existing empty state (`role="list"` replaced by a `<section>` with heading and paragraph) is accessible. No change needed.

## Testing Impact

- `app-categories.component.spec.ts`: Mocks `CategoryService.categories$`. Tests need to account for Favorites appearing when mocks include a favorited app.
- `dashboard.component.spec.ts`: Mocks `CategoryService.categories$` with `[APP_CATEGORY]`. If favorites are added to mock data, the test setup should still work because the mock explicitly controls `categories$`.
- **New tests recommended** for `CategoryService`, `SearchService`, and `AppService` to cover favorites logic, though no spec files exist for these services today.
- Since `strict_tdd: true` in `openspec/config.yaml`, any implementation MUST include tests.

## Open Questions for Design/Spec Phase

1. Should the Favorites category have a visual indicator (star icon)?
2. Should favorited apps ALSO appear in their original category, or ONLY in Favorites? (Assumption: they appear in BOTH — the current flat apps list + category filtering means an app is always in the "Apps" category and its own category; Favorites is just another filter.)
3. Should bookmarks support favorites in a future iteration?
4. Should there be a `showFavorites` setting? (User didn't ask for it; defer.)
