# Changelog

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
