# Design: Favorites Feature

## Technical Approach

Add `favorite: boolean` to `SelfhostedAppSchema` (defaults `false`). Introduce `FAVORITES_CATEGORY` as a virtual category, following the existing `APP_CATEGORY`/`BOOKMARKS_CATEGORY` pattern. Derive the visible category list dynamically in `CategoryService`, prepend `FAVORITES_CATEGORY` when at least one app is favorited, and handle filtering via the `favorite` flag in `SearchService` and `AppService`. Consolidate auto-selection and fallback logic into `CategoryService` to eliminate duplication with `AppService`.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Virtual category ordering | Prepend Favorites, then sort remaining categories A-Z | Sort everything A-Z; custom weights | Proposal requires Favorites first; minimal change to existing A-Z behavior |
| Auto-selection/fallback owner | `CategoryService` | `AppService.apps$` tap | Single responsibility; `CategoryService` already owns category state and derivation |
| Favorite flag on bookmarks | Out of scope | Add `favorite` to `BookmarkSchema` | Proposal explicitly excludes bookmarks |
| App category retention | Keep original `category` on favorited apps | Overwrite with `FAVORITES_CATEGORY.id` | Apps must still appear under their real category when not filtering by Favorites |

## Data Flow

```
dashboard.yaml --→ ConfigService.config$
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
 CategoryService    AppService      SearchService
 categories$         apps$           filterApps()
   │                  │                ▲
   │             filteredApps$ ◄───────┘
   │                  │
   └────────────► DashboardComponent
                  AppCategoriesComponent
```

1. **Config load** → `ConfigService.config$` emits parsed `DashboardConfig`
2. **Category derivation** → `CategoryService.categories$` builds `[FAVORITES?, Apps?, Bookmarks?, ...userCategories].sort()` and auto-corrects `selectedCategory$` if the current selection disappears
3. **App aggregation** → `AppService.apps$` emits `[...applications, ...bookmarks(with favorite:false)]`
4. **Filtering** → `SearchService.filterApps` handles `FAVORITES_CATEGORY.id` by checking `app.favorite === true`
5. **Rendering** → Components consume `categories$` and `filteredApps$` via `toSignal`

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/core/models/dashboard.models.ts` | Modify | Add `favorite: z.boolean().default(false)` to `SelfhostedAppSchema`; add `FAVORITES_CATEGORY` constant |
| `src/app/core/services/category.service.ts` | Modify | Prepend `FAVORITES_CATEGORY` when `applications.some(a => a.favorite)`; add subscription to fallback selected category |
| `src/app/core/services/app.service.ts` | Modify | Remove `tap` auto-selection; add `favorite: false` to bookmark mapping; handle `FAVORITES_CATEGORY` in `getAppsByCategory` |
| `src/app/core/services/search.service.ts` | Modify | Add `categoryId === FAVORITES_CATEGORY.id` branch in `filterApps` |
| `src/app/core/services/category.service.spec.ts` | Create | Derivation order, dynamic show/hide, fallback logic |
| `src/app/core/services/app.service.spec.ts` | Create | `apps$` emission, `getAppsByCategory`, `filteredApps$` integration |
| `src/app/core/services/search.service.spec.ts` | Create | Category filtering including Favorites, search text filtering |
| `src/app/shared/components/app-categories/app-categories.component.spec.ts` | Modify | Include `FAVORITES_CATEGORY` in mock category lists where appropriate |
| `src/app/views/dashboard/dashboard.component.spec.ts` | Modify | Update mock `categories$` if test assertions depend on count/order |
| `README.md` | Modify | Document `favorite` field in applications configuration reference |

## Interfaces / Contracts

```typescript
// dashboard.models.ts
export const FAVORITES_CATEGORY: Category = {
  id: 'favorites',
  name: 'Favorites',
};

export const SelfhostedAppSchema = z.object({
  // ...existing fields
  favorite: z.boolean().default(false),
});
```

**CategoryService.categories$ contract**: Emits ordered list where `FAVORITES_CATEGORY` is at index 0 when `config.applications.some(a => a.favorite)`, otherwise omitted.

**CategoryService.selectedCategory$ contract**: Automatically falls back to the first visible category ID whenever the current selection is no longer present in `categories$`.

**SearchService.filterApps contract**: When `categoryId === 'favorites'`, returns only apps where `favorite === true`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `CategoryService.categories$` | `TestBed` with mocked `ConfigService`; assert Favorites prepended only when favorites exist |
| Unit | `CategoryService` fallback | Emit config removing favorites while Favorites is selected; assert selection falls back to first visible category |
| Unit | `AppService.apps$` | Mock `ConfigService` + `BookmarkService`; assert bookmarks receive `favorite: false` |
| Unit | `AppService.getAppsByCategory` | Direct service method calls; assert Favorites returns only `favorite: true` apps |
| Unit | `SearchService.filterApps` | Direct method calls; assert Favorites + search query combinations |
| Integration | `AppService.filteredApps$` | `TestBed`; assert combineLatest of `apps$`, search, and category produces correct filtered arrays |
| Component | `app-categories` | Update mocks; verify `aria-pressed` and click behavior with Favorites present |

## Migration / Rollout

No migration required. `favorite` defaults to `false`, so existing `dashboard.yaml` files without the field remain valid. Removing `favorite` fields is a backward-compatible rollback.

## Accessibility Considerations

- **Dynamic tabs**: `app-categories` uses `@for (track category.id)`. Focus is preserved when Favorites appears/disappears because Angular's reconciliation maintains button identity.
- **aria-pressed**: The Favorites button receives `aria-pressed` automatically via the existing binding.
- **AXE**: Verify zero violations after implementation; dynamic content insertion at the head of a navigation region is acceptable when focus is not forcibly moved.

## Open Questions

None.
