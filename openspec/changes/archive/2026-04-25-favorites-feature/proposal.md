# Proposal: Favorites Feature

## Intent

Allow users to mark applications as favorites in `dashboard.yaml` via a `favorite: true/false` flag. Favorited apps are grouped under a dynamic **Favorites** virtual category that appears automatically when at least one favorite exists.

## Scope

### In Scope
- Add `favorite` boolean to `SelfhostedAppSchema` (defaults to `false`)
- Introduce `FAVORITES_CATEGORY` constant and virtual category logic
- Update `CategoryService`, `AppService`, and `SearchService` to derive and filter the Favorites category
- Adjust default category selection when `showAllCategory: false`
- Update component tests and add service-level unit tests (strict TDD)
- Document the new field in `README.md`

### Out of Scope
- Favorite support for bookmarks
- Settings toggle to disable Favorites
- Visual star icons or design tokens (deferred to design phase)

## Capabilities

### New Capabilities
- `app-favorites`: Per-application favorite flag with dynamic virtual category grouping

### Modified Capabilities
- None

## Approach

**Virtual Favorites Category** — follows the existing `APP_CATEGORY` and `BOOKMARKS_CATEGORY` pattern.

- `favorite` defaults to `false`, preserving backward compatibility
- `FAVORITES_CATEGORY` is injected at the **head** of the derived category list when `applications.some(a => a.favorite)`
- `SearchService.filterApps` and `AppService.getAppsByCategory` filter by `app.favorite === true` when the Favorites category is active
- `AppService.apps$` tap selects the **first visible category** (not hard-coded `config.categories[0]`) when `showAllCategory` is disabled
- If Favorites disappears at runtime (config reload), selection falls back to the first remaining visible category

## Affected Areas

| File | Impact |
|------|--------|
| `src/app/core/models/dashboard.models.ts` | Add `favorite` to schema; add `FAVORITES_CATEGORY` constant |
| `src/app/core/services/category.service.ts` | Prepend `FAVORITES_CATEGORY` dynamically |
| `src/app/core/services/app.service.ts` | Handle Favorites in `getAppsByCategory`; fix auto-selection logic |
| `src/app/core/services/search.service.ts` | Handle `FAVORITES_CATEGORY` in `filterApps` |
| `src/app/shared/components/app-categories/app-categories.component.spec.ts` | Update mocks for dynamic category list |
| `src/app/views/dashboard/dashboard.component.spec.ts` | Update mocks if needed |
| `README.md` | Document `favorite` field |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| No existing service-level unit tests | High | Create specs for `CategoryService`, `SearchService`, and `AppService` as part of this change |
| Favorites category disappears while selected | Low | Auto-fallback to first visible category on category list change |
| Accessibility regressions from dynamic tabs | Low | Verify `aria-pressed`, focus order, and AXE checks after implementation |

## Rollback Plan

Revert the commits or remove `favorite` fields from `dashboard.yaml`. The schema default (`false`) ensures the app remains functional without config changes.

## Dependencies

None.

## Success Criteria

- [ ] `favorite: true` in YAML causes the Favorites category to appear **first** in the category list
- [ ] Favorites category is **hidden** when no apps are favorited
- [ ] Selecting Favorites shows only favorited apps
- [ ] `showAllCategory: false` auto-selects Favorites when favorites exist
- [ ] All new and existing tests pass under `strict_tdd`
- [ ] AXE audit passes with zero violations
