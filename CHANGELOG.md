# Changelog

## Unreleased

### Bug Fixes

- **Sticky Header and Finder**: Header, finder, and categories now stay fixed while only the apps area scrolls, improving navigation when dealing with many applications.
- **Production Logging Cleanup**: Replaced development-only `console.log` usage in dashboard initialization and config loading flows with a centralized logger service, while removing the dashboard click debug log from production code.

### Performance

- **OnPush Change Detection**: Enabled `ChangeDetectionStrategy.OnPush` across all application components and made theme and card visibility state signal-reactive so their rendered values remain current without unnecessary tree-wide change detection.

### CI / Tooling

- **Release Notes Template**: Fixed the `create-release.yml` workflow to respect the `.github/release.yml` configuration when generating release notes. Previously the workflow called the GitHub API directly without passing `configuration_file_path` and `configuration_file_name`, causing the custom categories and exclusions to be ignored.
- **Node 22 LTS CI Runtime**: Pinned the GitHub Actions Node.js test workflow to Node 22 LTS and documented Node 22 LTS in the README as the recommended local version because it matches CI.
- **Focused Test CI Guard**: Added a repository-level guard that fails pull request CI when committed focused tests such as `.only`, `fit`, `fdescribe`, or `.only.each(...)` are present, with regression coverage for the checker and its CLI contract.
- **Automated Axe Accessibility Checks**: Added reusable axe-core assertions for covered `app-finder`, `app-card`, `app-categories`, and `dashboard` render states. Because CI already runs `npm test`, violations found by those checks now fail the existing test workflow automatically.
- **ESLint and Scoped Source Formatting**: Added lint-staged ESLint autofixes for staged TypeScript, including `test-setup.ts`, and Prettier formatting for staged TypeScript, HTML, and SCSS. Pull request CI now enforces focused-test detection, linting, scoped formatting, tests, and the production build.

### Documentation

- **Accessibility Testing Policy**: Documented that `npm test` includes axe-core accessibility checks for the covered component states, and that the jsdom helper excludes `color-contrast` until browser-level support is available.
- **Linting Workflow**: Documented local linting, source-only formatting, and staged-file pre-commit automation.

### Changed Files

- `.github/workflows/test.yml`
- `README.md`
- `CHANGELOG.md`
- `package.json`
- `package-lock.json`
- `angular.json`
- `eslint.config.js`
- `.husky/pre-commit`
- `scripts/check-focused-tests.mjs`
- `scripts/check-focused-tests.test.mjs`
- `src/testing/tooling-setup.spec.ts`
- `src/testing/check-focused-tests-cli.spec.ts`
- `src/testing/node-test-harness.d.ts`
- `src/testing/a11y.ts`
- `src/app/core/initializers/dashboard.initializer.ts`
- `src/app/core/services/app.service.ts`
- `src/app/core/services/logger.service.ts`
- `src/app/core/services/logger.service.spec.ts`
- `src/app/core/services/yaml-loader.service.ts`
- `src/app/app.ts`
- `src/app/shared/components/app-card/app-card.component.html`
- `src/app/shared/components/app-card/app-card.component.spec.ts`
- `src/app/shared/components/app-card/app-card.component.ts`
- `src/app/shared/components/app-clock/app-clock.component.spec.ts`
- `src/app/shared/components/app-clock/app-clock.component.ts`
- `src/app/shared/components/app-categories/app-categories.component.spec.ts`
- `src/app/shared/components/app-finder/app-finder.component.spec.ts`
- `src/app/shared/components/app-footer/app-footer.component.ts`
- `src/app/shared/components/app-header/app-header.component.spec.ts`
- `src/app/shared/components/app-header/app-header.component.ts`
- `src/app/shared/components/app-loading/app-loading.component.ts`
- `src/app/views/dashboard/dashboard.component.html`
- `src/app/views/dashboard/dashboard.component.spec.ts`
- `src/app/views/dashboard/dashboard.component.ts`

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
