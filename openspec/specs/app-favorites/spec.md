# App Favorites Specification

## Purpose
Allow users to mark applications as favorites in `dashboard.yaml` via a `favorite` boolean. Favorited apps are grouped under a dynamic virtual **Favorites** category that appears automatically when at least one favorite exists.

## Requirements

### Requirement: Schema
The system MUST support a `favorite` boolean field on each application, defaulting to `false`. The system MUST expose `FAVORITES_CATEGORY` as a virtual category constant (`id: 'favorites'`, `name: 'Favorites'`).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `favorite` | `boolean` | `false` | Marks app as favorited |

#### Scenario: Default parsing
- GIVEN an application without `favorite` in YAML
- WHEN the config is parsed
- THEN `favorite` equals `false`

### Requirement: Category Derivation
The system MUST include `FAVORITES_CATEGORY` as the first category when at least one application has `favorite: true`. Virtual categories MUST appear before user-defined categories; user-defined categories MUST be sorted A-Z.

#### Scenario: Favorites visible
- GIVEN ≥1 app with `favorite: true`
- WHEN `categories$` emits
- THEN `FAVORITES_CATEGORY` is first

#### Scenario: Favorites hidden
- GIVEN zero favorited apps
- WHEN `categories$` emits
- THEN `FAVORITES_CATEGORY` is absent

#### Scenario: Category order
- GIVEN `showAllCategory: true` and `allowBookmarks: true`
- WHEN `categories$` emits
- THEN virtuals appear first, followed by user categories sorted A-Z

### Requirement: App Filtering
The system MUST filter apps by `favorite === true` when `FAVORITES_CATEGORY` is active. Bookmarks MUST NOT support favorites.

#### Scenario: Filter by favorites
- GIVEN `categoryId === 'favorites'`
- WHEN `filterApps` executes
- THEN only apps with `favorite === true` are returned

#### Scenario: Search bypasses category filter
- GIVEN active search query and `searchAll === true`
- WHEN `filterApps` executes
- THEN all matching apps are returned regardless of favorite status

#### Scenario: Original category still shows favorited apps
- GIVEN an app with `favorite: true` and `category: 'media'`
- WHEN Media category is selected
- THEN the app is included

### Requirement: Default Selection
When `showAllCategory` is `false`, the system MUST auto-select the first visible category.

#### Scenario: Favorites is first visible
- GIVEN `showAllCategory: false` and favorites exist
- WHEN config initializes
- THEN `FAVORITES_CATEGORY` is selected

#### Scenario: No favorites fallback
- GIVEN `showAllCategory: false` and no favorites
- WHEN config initializes
- THEN the first user-defined category is selected

#### Scenario: Runtime disappearance
- GIVEN Favorites is selected and all favorites are removed
- WHEN config reloads
- THEN selection falls back to the first remaining visible category

### Requirement: Test Coverage
The system MUST include unit tests for `CategoryService`, `AppService`, and `SearchService` covering favorites logic.

#### Scenario: CategoryService favorites
- GIVEN favorited apps exist
- WHEN `categories$` is subscribed
- THEN `FAVORITES_CATEGORY` is first

#### Scenario: SearchService favorites filter
- GIVEN mixed favorited and non-favorited apps
- WHEN filtering by Favorites category
- THEN only favorited apps are returned

### Requirement: Documentation
The `favorite` field MUST be documented in `README.md` under the applications reference table.

## Non-Functional Requirements

### Accessibility
Dynamic addition or removal of the Favorites category MUST pass AXE checks with zero violations. Focus order MUST remain logical.

### Performance
Category derivation and app filtering latency MUST remain under 50ms.
