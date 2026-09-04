# Changelog

## Unreleased

### New Features

- **Browser-Based YAML Configurator**: Added a lazy `/configure` route with typed reactive forms for building and editing dashboard configuration (metadata, settings, categories, applications, bookmarks) without hand-authoring YAML. Users can start from an empty draft, load the currently mounted `dashboard.yaml`, or import a local YAML file, then copy or download a validated, canonically-serialized result. Export happens entirely in the browser and never writes to the mounted configuration or a server.
- **Header Navigation to Configurator**: Added a link next to the theme toggle so users can jump into the configurator (gear icon) and back to the dashboard (arrow icon) without editing the URL by hand. The header tracks the active route to decide which icon, label, and target to show.

### Changed

- **Themed Header Icons**: Replaced the header emoji controls with Heroicons outline so the configurator gear, back arrow, and theme sun/moon inherit light and dark text color instead of staying platform-colored.
- **Shared Configuration Validation**: Extended the dashboard schema with cross-collection validation shared by the loader and configurator: unique IDs across categories, applications, and bookmarks, application `category` values that must match a declared category ID, and category IDs reserved for virtual categories (`apps`, `bookmarks`, `favorites`).
- **YAML Loader Outcomes**: Reworked `YamlLoaderService` to preserve distinguishable outcomes (mounted config, runtime fallback, parse/validation errors) so the configurator can accurately offer a "load mounted YAML" entry point.

### Testing & Quality

- **Configurator Test Coverage**: Added unit and component tests for the configurator routes, store, collection editor, and page component, plus expanded coverage for dashboard model validation, the YAML codec, and the export service.

### Documentation

- **Configurator Export Guidance**: Documented the `/configure` export flow, browser-only validation, and normalization behavior in the README, along with the ID-uniqueness and category-reference constraints for categories, applications, and bookmarks.

### Changed Files

- `README.md`
- `config/dashboard.example.yaml`
- `src/app/app.html`
- `src/app/app.routes.spec.ts`
- `src/app/app.routes.ts`
- `src/app/app.spec.ts`
- `src/app/app.ts`
- `src/app/core/models/dashboard.models.spec.ts`
- `src/app/core/models/dashboard.models.ts`
- `src/app/core/services/config-export.service.spec.ts`
- `src/app/core/services/config-export.service.ts`
- `src/app/core/services/yaml-codec.service.spec.ts`
- `src/app/core/services/yaml-codec.service.ts`
- `src/app/core/services/yaml-loader.service.spec.ts`
- `src/app/core/services/yaml-loader.service.ts`
- `src/app/features/configurator/components/collection-editor.component.html`
- `src/app/features/configurator/components/collection-editor.component.spec.ts`
- `src/app/features/configurator/components/collection-editor.component.ts`
- `src/app/features/configurator/configurator-page.component.html`
- `src/app/features/configurator/configurator-page.component.spec.ts`
- `src/app/features/configurator/configurator-page.component.ts`
- `src/app/features/configurator/configurator.routes.ts`
- `src/app/features/configurator/configurator.store.spec.ts`
- `src/app/features/configurator/configurator.store.ts`
- `src/app/shared/components/app-header/app-header.component.html`
- `src/app/shared/components/app-header/app-header.component.spec.ts`
- `src/app/shared/components/app-header/app-header.component.ts`
- `src/app/shared/components/app-shell/app-shell.component.html`
- `src/app/shared/components/app-shell/app-shell.component.ts`
- `src/app/views/dashboard/dashboard.component.html`
- `src/app/views/dashboard/dashboard.component.spec.ts`
- `src/app/views/dashboard/dashboard.component.ts`
- `test-setup.ts`

### Summary

Adds a browser-based visual configurator for building and editing `dashboard.yaml` through accessible forms, plus header navigation between the dashboard and the new `/configure` route with theme-aware header icons. Deployments remain read-only: exports are validated and canonically serialized entirely in the browser. There are no intentional breaking changes.

## v1.1.0

### New Features

- **Accessible Search Engine Selector**: Added a focused search engine selector with arrow, Home, End, and Escape keyboard navigation, predictable focus management, and focus-based closing.
- **Resilient Error Feedback**: Added a signal-based notification service and accessible toast UI, bounded retries for transient dashboard loading failures, warnings when theme preferences cannot be persisted, and a safe fallback for uncaught application errors.

### Bug Fixes

- **Sticky Header and Finder**: Header, finder, and categories now stay fixed while only the apps area scrolls, improving navigation when dealing with many applications.
- **Toast Styling**: Aligned notification toasts with the application card design through consistent borders, shadows, spacing, and status accents.
- **Dashboard App Grid Spacing**: Added spacing above the application grid so cards no longer sit directly against the dashboard controls.
- **Production Logging Cleanup**: Replaced development-only `console.log` usage in dashboard initialization and config loading flows with a centralized logger service, while removing the dashboard click debug log from production code.
- **Search Popup Query Preservation**: Preserved the current search query when the browser blocks an external search popup.

### Performance

- **OnPush Change Detection**: Enabled `ChangeDetectionStrategy.OnPush` across all application components and made theme and card visibility state signal-reactive so their rendered values remain current without unnecessary tree-wide change detection.
- **Signal-Based Application State**: Migrated synchronous configuration, settings, search, category, bookmark, metadata, filtering, and theme state to Angular signals while retaining RxJS only for asynchronous YAML loading. Theme initialization now tolerates unavailable browser storage and reconciles delayed YAML configuration without overriding user preferences.

### CI / Tooling

- **Release Notes Template**: Updated the `create-release.yml` workflow to generate notes for a new tag from the pushed commit and load the custom categories and exclusions through `configuration_file_path=.github/release.yml`.
- **Node 22 LTS CI Runtime**: Pinned the GitHub Actions Node.js test workflow to Node 22 LTS and documented Node 22 LTS in the README as the recommended local version because it matches CI.
- **Focused Test CI Guard**: Added a repository-level guard that fails pull request CI when committed focused tests such as `.only`, `fit`, `fdescribe`, or `.only.each(...)` are present, with regression coverage for the checker and its CLI contract.
- **ESLint and Scoped Source Formatting**: Added lint-staged ESLint autofixes for staged TypeScript, including `test-setup.ts`, and Prettier formatting for staged TypeScript, HTML, and SCSS. Pull request CI now enforces focused-test detection, linting, scoped formatting, tests, and the production build.

### Testing & Quality

- **Automated Axe Accessibility Checks**: Added reusable axe-core assertions for covered `app-finder`, `app-card`, `app-categories`, and `dashboard` render states. Because CI already runs `npm test`, violations found by those checks now fail the existing test workflow automatically.
- **Core Coverage CI Gate**: Added behavior coverage for core services and initializers, reaching 97.31% statement coverage with a 70% CI threshold and uploaded coverage reports.

### Documentation

- **Architecture Guide**: Added a current contributor architecture guide and linked it from the
  README.
- **Accessibility Testing Policy**: Documented that `npm test` includes axe-core accessibility checks for the covered component states, and that the jsdom helper excludes `color-contrast` until browser-level support is available.
- **Linting Workflow**: Documented local linting, source-only formatting, and staged-file pre-commit automation.

### Changed Files

- `.github/workflows/create-release.yml`
- `.github/workflows/test.yml`
- `.husky/pre-commit`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `CHANGELOG.md`
- `README.md`
- `angular.json`
- `eslint.config.js`
- `package-lock.json`
- `package.json`
- `scripts/check-focused-tests.mjs`
- `scripts/check-focused-tests.test.mjs`
- `src/app/app.config.spec.ts`
- `src/app/app.config.ts`
- `src/app/app.html`
- `src/app/app.spec.ts`
- `src/app/app.ts`
- `src/app/core/errors/global-error-handler.spec.ts`
- `src/app/core/errors/global-error-handler.ts`
- `src/app/core/initializers/dashboard.initializer.spec.ts`
- `src/app/core/initializers/dashboard.initializer.ts`
- `src/app/core/models/dashboard.models.ts`
- `src/app/core/services/app.service.spec.ts`
- `src/app/core/services/app.service.ts`
- `src/app/core/services/bookmark.service.spec.ts`
- `src/app/core/services/bookmark.service.ts`
- `src/app/core/services/category.service.spec.ts`
- `src/app/core/services/category.service.ts`
- `src/app/core/services/config.service.spec.ts`
- `src/app/core/services/config.service.ts`
- `src/app/core/services/icon.service.spec.ts`
- `src/app/core/services/icon.service.ts`
- `src/app/core/services/logger.service.spec.ts`
- `src/app/core/services/logger.service.ts`
- `src/app/core/services/metadata.service.spec.ts`
- `src/app/core/services/metadata.service.ts`
- `src/app/core/services/notification.service.spec.ts`
- `src/app/core/services/notification.service.ts`
- `src/app/core/services/search.service.spec.ts`
- `src/app/core/services/search.service.ts`
- `src/app/core/services/settings.service.spec.ts`
- `src/app/core/services/settings.service.ts`
- `src/app/core/services/theme.service.spec.ts`
- `src/app/core/services/theme.service.ts`
- `src/app/core/services/yaml-loader.service.spec.ts`
- `src/app/core/services/yaml-loader.service.ts`
- `src/app/core/services/yaml-parser.service.spec.ts`
- `src/app/core/services/yaml-parser.service.ts`
- `src/app/shared/components/app-card/app-card.component.html`
- `src/app/shared/components/app-card/app-card.component.spec.ts`
- `src/app/shared/components/app-card/app-card.component.ts`
- `src/app/shared/components/app-categories/app-categories.component.html`
- `src/app/shared/components/app-categories/app-categories.component.spec.ts`
- `src/app/shared/components/app-categories/app-categories.component.ts`
- `src/app/shared/components/app-clock/app-clock.component.html`
- `src/app/shared/components/app-clock/app-clock.component.spec.ts`
- `src/app/shared/components/app-clock/app-clock.component.ts`
- `src/app/shared/components/app-finder/app-finder.component.html`
- `src/app/shared/components/app-finder/app-finder.component.spec.ts`
- `src/app/shared/components/app-finder/app-finder.component.ts`
- `src/app/shared/components/app-footer/app-footer.component.html`
- `src/app/shared/components/app-footer/app-footer.component.ts`
- `src/app/shared/components/app-header/app-header.component.spec.ts`
- `src/app/shared/components/app-header/app-header.component.ts`
- `src/app/shared/components/app-loading/app-loading.component.ts`
- `src/app/shared/components/app-search-engine-selector/app-search-engine-selector.component.html`
- `src/app/shared/components/app-search-engine-selector/app-search-engine-selector.component.spec.ts`
- `src/app/shared/components/app-search-engine-selector/app-search-engine-selector.component.ts`
- `src/app/shared/components/app-toast/app-toast.component.css`
- `src/app/shared/components/app-toast/app-toast.component.html`
- `src/app/shared/components/app-toast/app-toast.component.spec.ts`
- `src/app/shared/components/app-toast/app-toast.component.ts`
- `src/app/views/dashboard/dashboard.component.html`
- `src/app/views/dashboard/dashboard.component.spec.ts`
- `src/app/views/dashboard/dashboard.component.ts`
- `src/index.html`
- `src/main.ts`
- `src/testing/a11y.ts`
- `src/testing/check-focused-tests-cli.spec.ts`
- `src/testing/node-test-harness.d.ts`
- `src/testing/tooling-setup.spec.ts`
- `tsconfig.spec.json`

### Summary

Minor release introducing new user-facing accessibility and error-feedback capabilities, alongside substantial reliability, performance, testing, and contributor-tooling improvements. There are no intentional breaking changes.

## v1.0.1

### Bug Fixes

- **Mobile Background**: Fixed background image shifting when navigating between categories on mobile devices. The background is now rendered on a fixed-position layer independent of content height.

### CI / Tooling

- **Auto-Release Workflow**: Added GitHub Actions workflow that automatically creates a tag and GitHub release when pushing to `main`.

### Legal

- **License**: Added GNU General Public License v3.0 (project was previously unlicensed).
- **License Badge**: Updated shields badge to reflect GPL v3.0.

### Documentation

- **README**: Updated version references and license information.

### Changed Files

- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `src/index.html`
- `src/styles.css`
- `src/app/views/dashboard/dashboard.component.ts`
- `src/app/views/dashboard/dashboard.component.spec.ts`
- `.github/workflows/create-release.yml`

### Summary

Patch release that fixes a mobile background shifting issue, adds automatic release CI/CD, and licenses the project under GPL v3.0.

## v1.0.0

### New Features

- **Favorite Applications**: Added support for marking applications as favorites. Favorites are automatically grouped into a dedicated "Favorites" category and can be filtered via search.

### Testing & Quality

- **Component Test Suite**: Added comprehensive tests for `app-header`, `app-card`, `app-categories`, `app-finder`, and `dashboard` components.
- **Service Test Coverage**: Added unit tests for `AppService`, `CategoryService`, `SearchService`, and `YamlParserService`.
- **Keyboard Accessibility**: Added keyboard event handling and test coverage for `Space` and `Enter` activation on interactive elements.

### CI / Tooling

- **PR Test Workflow**: Added automated test execution for pull requests targeting `develop` and `main`.
- **CODEOWNERS**: Added `CODEOWNERS` file requiring `rackandhost` approval for changes.

### Changed Files

- `src/app/core/models/dashboard.models.ts`
- `src/app/core/services/app.service.ts`
- `src/app/core/services/app.service.spec.ts`
- `src/app/core/services/category.service.ts`
- `src/app/core/services/category.service.spec.ts`
- `src/app/core/services/search.service.ts`
- `src/app/core/services/search.service.spec.ts`
- `src/app/core/services/yaml-parser.service.spec.ts`
- `src/app/shared/components/app-card/app-card.component.html`
- `src/app/shared/components/app-card/app-card.component.ts`
- `src/app/shared/components/app-card/app-card.component.spec.ts`
- `src/app/shared/components/app-categories/app-categories.component.html`
- `src/app/shared/components/app-categories/app-categories.component.ts`
- `src/app/shared/components/app-categories/app-categories.component.spec.ts`
- `src/app/shared/components/app-finder/app-finder.component.html`
- `src/app/shared/components/app-finder/app-finder.component.spec.ts`
- `src/app/shared/components/app-header/app-header.component.spec.ts`
- `src/app/views/dashboard/dashboard.component.spec.ts`
- `README.md`
- `package.json`
- `package-lock.json`
- `.github/workflows/test.yml`
- `CODEOWNERS`

### Summary

This release marks the v1.0.0 stable release, removing beta references. It introduces favorite application support, significantly expands test coverage across components and services, and adds CI automation for pull requests.

## v0.2.0

### Bug Fixes & Improvements
- **Theme Support**: Added light and dark theme support with different background images
- **Custom Background**: Added ability to use custom background images with URL support
- **Service Improvements**: Added destroy subscriptions in config service to prevent memory leaks

### Changed Files
- `src/app/core/models/dashboard.models.ts`
- `src/app/core/services/app.service.ts`
- `src/app/core/services/config.service.ts`
- `src/app/core/services/settings.service.ts`
- `src/app/core/services/theme.service.ts`
- `src/app/views/dashboard/dashboard.component.ts`
- `src/styles.css`

## v0.1.2-beta

### Bug Fixes & Improvements

- **Mobile UX**: Added arrow icon to app-finder to enable search functionality on mobile devices
- **Documentation**: Added new screenshot and updated version in README.md

### Changed Files

- `src/app/shared/components/app-finder/app-finder.component.html`
- `src/app/shared/components/app-finder/app-finder.component.ts`
- `README.md`
- `screenshots/dashboard.png`

### Summary

Focused on improving mobile user experience with a search icon, alongside documentation and version updates for v0.1.2-beta.

## v0.1.1-beta

### Bug Fixes & Improvements

- **Accessibility**: Added accessibility attributes to the search engines selector (`app-finder`)
- **UI Consistency**: Controlled icon sizes in application cards (`app-card`)
- **Branding**: Added/updated favicon in the application
- **Documentation**: Updated dashboard screenshots

### Changed Files

- `src/components/app-card/app-card.component.html`
- `src/components/app-finder/app-finder.component.html`
- `src/index.html`
- `screenshots/dashboard.png`

### Summary

Improvements focused on accessibility, visual consistency, and visual asset updates for v0.1.1-beta version.
