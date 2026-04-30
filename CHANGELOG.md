# Changelog

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
