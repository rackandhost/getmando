# Verify Report: UI Redesign — "Consola"

Status: **in progress** — only the baseline (task 0.5) is filled in. Later sections are filled by
tasks 1.x (checkpoint 1), 2.x (checkpoint 2), 3.x (checkpoint 3) and 4.2–4.6.

## 1. Baseline (task 0.5) — before any UI change

Captured 2026-10-13 on branch `feature/ui-redesign` at `538b67e`.

**Equivalence with `develop`:** `git diff develop -- src public angular.json` is empty (0 lines); the
only differences from `develop` are `openspec/**` and two unused dependencies in `package.json`
(fonts, not yet wired). The build below is therefore the `develop` build.

### Method

- `ng build` (production) → `/tmp/mando-baseline`, served statically on `127.0.0.1:4300` with an SPA
  fallback. **No write sidecar**, so `GET /api/status` returns 404 and no status badges are rendered
  (the sample config has `healthCheck: true`); icons load from `cdn.jsdelivr.net`.
- Config: `public/config/dashboard.yaml` (10 apps, 4 categories), the sample used in the mockup.
- Lighthouse 12.8.2 with `/usr/bin/chromium` headless, 3 runs per profile, desktop preset and default
  mobile profile; categories performance, accessibility, best-practices. Raw medians in
  `baseline/lighthouse-summary.json`.
- Screenshots: Chromium headless, 1.25× device scale, theme switched with the app's own toggle.

### Build output

| Chunk                      | Raw           | Estimated transfer |
| -------------------------- | ------------- | ------------------ |
| `chunk-*.js` (framework)   | 568.36 kB     | 124.89 kB          |
| `main-*.js`                | 130.20 kB     | 33.67 kB           |
| `styles-*.css`             | 46.76 kB      | 6.43 kB            |
| **Initial total**          | **745.32 kB** | **164.98 kB**      |
| Lazy `configurator-routes` | 49.08 kB      | 9.94 kB            |

- The initial bundle already exceeds the 500 kB **warning** budget by 245.32 kB (pre-existing; the
  error budget is 1 MB). The redesign must not push it further without a recorded reason.
- `dist/browser` is 3.34 MB; images dominate: `img/background-light.jpg` 1.76 MB, `img/mando.png`
  613 kB, `img/background.jpg` 153 kB. The mockup uses these same images.
- Static assets: no web fonts today (so Phase 1 adds the first font files).

### Lighthouse (median of 3 runs; variance ≈ 0)

| Metric         | Desktop | Mobile  |
| -------------- | ------- | ------- |
| Performance    | **84**  | **62**  |
| Accessibility  | 96      | 96      |
| Best practices | 96      | 96      |
| FCP            | 0.80 s  | 4.35 s  |
| LCP            | 2.84 s  | 15.45 s |
| TBT            | 0 ms    | 162 ms  |
| CLS            | 0       | 0       |
| Transfer       | 3.39 MB | 3.39 MB |

Success criterion to compare against (`proposal.md` § Success Criteria 7): performance not worse than
**84 desktop / 62 mobile by more than 5 points**. LCP element: the first app icon fetched from the CDN
(`<img loading="lazy" … Nextcloud icon>`); the 1.72 MB light background is the heaviest request.

### Pre-existing accessibility findings (Lighthouse/axe, both profiles)

These exist on `develop` today and are **not** caused by this change. The redesign touches both
elements, so each must be either fixed there or explicitly accepted at checkpoint 2 / 4.6.

| Audit                         | Element                                                      | Cause                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `aria-prohibited-attr`        | `app-toast .toast-stack` (`div[aria-label="Notifications"]`) | `aria-label` on a `div` with no role                                                                                                   |
| `label-content-name-mismatch` | every app card `button` (10)                                 | Accessible name `Open <name>[, currently up\|down]` does not contain the visible text (description and tags), WCAG 2.5.3 Label in Name |

**Decisions (owner, 2026-10-13):** both get fixed within the redesign without altering the look. The card keeps
the mockup's wording (`<name>, online|offline`) but moves to a stretched-link structure (D-k, task 2.8): the mockup's own
markup was measured in Chromium with axe and **also fails** `label-content-name-mismatch`; the stretched-link variant
passes. The toast is fixed in its own task (D-l, task 2.10). Both are verified at checkpoint 2.

### Reference screenshots (`baseline/`)

| File                                | State                   |
| ----------------------------------- | ----------------------- |
| `dashboard-dark-1440x900.png`       | Dashboard, dark         |
| `dashboard-light-1440x900.png`      | Dashboard, light        |
| `dashboard-mobile-dark-390x844.png` | Dashboard, mobile, dark |
| `configurator-dark-1440x900.png`    | Configurator, dark      |
| `configurator-light-1440x900.png`   | Configurator, light     |

## 2. Checkpoint 1 — Foundation

_Not started._

## 3. Checkpoint 2 — Dashboard (incl. loop smoke: 1, 2, 3, 4, 10 rows)

_Not started._

## 4. Checkpoint 3 — Configurator

_Not started._

## 5. Scenario → evidence (task 4.6)

_Not started._
