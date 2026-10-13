# Proposal: UI Redesign — "Consola"

## Intent

Replace the current frosted-glass-on-photo look with the **"Consola"** design: a sober, instrument-panel
aesthetic for a homelab dashboard — warm-neutral surfaces, a single amber accent, Nunito for UI text
and IBM Plex Mono for data (tags, status, dates, version), a large split-style clock, and a refined
glass treatment over the user's background image. The dashboard and the YAML configurator are
redesigned together so they read as one product, and the result MUST satisfy WCAG AA (repo rule), which
the raw mockup does not in a few places (see _Accessibility amendments_).

Reference: `mockup/` — screenshots of every state (`mockup/states/`), rendered sources, and a README.
It is the single source of visual truth; this change turns it into testable requirements.

## Decisions taken (owner, 2026-10-13)

| #   | Decision                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-a | **Clock contrast and colon blink MUST be accessible.** Minute-digit fill is strengthened; the colon does not blink (see _Accessibility amendments_).                                                                                                                                       |
| D-b | **Status badge**: the mockup's text pill (`● UP` / `● DOWN`) is adopted; requires the `app-status-check` delta.                                                                                                                                                                            |
| D-c | **Fonts are downloaded and self-hosted** (Nunito, IBM Plex Mono) — no third-party font requests.                                                                                                                                                                                           |
| D-d | The clock explorations (E–J) were only a study to choose the clock; the **split clock** of the dashboard artboards is the chosen design. Alternatives, `clockStyle: classic` and the accent picker are not shipped.                                                                        |
| D-f | **Q9 accepted:** light-theme legibility floors (cards and clock almost opaque white) are kept.                                                                                                                                                                                             |
| D-g | **Q2:** the date pill follows the `dateFormat` setting; the weekday pill is always the weekday.                                                                                                                                                                                            |
| D-h | **Q3:** `showSeconds` renders a small mono seconds readout beside the minutes (`design.md` § 4.2).                                                                                                                                                                                         |
| D-i | **Q10:** the configurator has a light theme and its theme button works exactly like the dashboard's (the prototype's button is not wired).                                                                                                                                                 |
| D-j | Dock viewport guards accepted, **plus a loop-free scroll model:** when there are few apps and the page cannot keep scrolling after the dock compacts, the dock stays static; compaction is gated by remaining scroll capacity, with a dead band and a circuit breaker (`design.md` § 4.1). |
| D-k | **Follow the redesign; fix accessibility without changing the look.** The card keeps the mockup's wording (`<name>, online                                                                                                                                                                 | offline`, pill `aria-hidden`) but uses a stretched-link structure so the name contains the link's visible text (the mockup's own markup fails axe `label-content-name-mismatch`, verified in Chromium). |
| D-l | The `app-toast` is brought into the redesign as its own task (2.10): card surface with legibility floor and token accents, and the baseline `aria-prohibited-attr` finding is fixed (`role="group"`).                                                                                      |
| D-e | The sticky/scroll behaviour, theme switching and states are taken from the **live prototype** (not guessed): sticky dock on desktop, sticky search + tabs on mobile, compact clock, sticky configurator header + scroll-spy side nav.                                                      |

## Scope

### In Scope

- A **design system** layer: colour/typography/radius/shadow/blur tokens for light and dark themes,
  self-hosted fonts, surface ("glass") recipes with legibility floors, focus ring, motion rules,
  contrast guarantees.
- **Dashboard** redesign (`/`): header chip + action buttons, split clock with weekday/date pills,
  search bar with engine selector (listbox) and submit/clear, underline category tabs, horizontal
  app cards with status pill, footer bar, empty state, responsive layout.
- **Scroll behaviour** from the prototype: desktop sticky dock (header + compact clock + shrunken
  search + tabs) with blur band; mobile sticky dock (search + tabs); hysteresis `> 40` / `≤ 4`.
- **Configurator** redesign (`/configure`): sticky header band, page heading, numbered scroll-spy
  side navigation (chip bar ≤ 900 px), section cards, segmented controls, switches, validation
  panel, inline app editor, export panel — same capabilities as today.
- Light/dark/auto theming; configured background images + scrim keep working.
- Update `README.md`, `ARCHITECTURE.md`, `screenshots/*`, `CHANGELOG.md`.

### Out of Scope

- Any change to the YAML schema, `config-write-api`, `app-status-check` server behaviour, polling
  cadence, or routing.
- Clock variants (`clockStyle: classic`, explorations E–J), accent colour options, user-adjustable
  overlay opacity — design-time knobs of the prototype, not product settings.
- Replacing Tailwind or the icon libraries.

## Capabilities

Scope check (spec-driven-development, Phase 0): the request bundles independently testable
capabilities, so this change is decomposed by module id. Module ids are stable.

| Module id           | Responsibility                                                       | Depends on      |
| ------------------- | -------------------------------------------------------------------- | --------------- |
| `design-system`     | Tokens, fonts, surfaces, theming, motion, focus, contrast guarantees | —               |
| `dashboard-ui`      | Dashboard layout/components, sticky dock, responsive behaviour       | `design-system` |
| `yaml-configurator` | Configurator layout and controls (delta on the existing capability)  | `design-system` |
| `app-status-check`  | Status badge presentation only (delta on the existing capability)    | `dashboard-ui`  |

Build order: `design-system` → `dashboard-ui` ∥ `yaml-configurator` → `app-status-check` badge delta
(lands with the card in `dashboard-ui`).

### New Capabilities

- `design-system` — `specs/design-system/spec.md`.
- `dashboard-ui` — `specs/dashboard-ui/spec.md`.

### Modified Capabilities

- `yaml-configurator` — presentation requirements added/modified; behaviour untouched
  (`specs/yaml-configurator/spec.md`).
- `app-status-check` — "Status badge is accessible": the non-colour cue changes from a check/cross
  glyph to a text label (`UP` / `DOWN`) (`specs/app-status-check/spec.md`).

## Accessibility amendments to the mockup

The mockup is the visual reference; these deliberate deviations are what make it pass WCAG AA.
Numbers and method: `design.md` § 5.

| Mockup                                                                                         | Amendment                                                                                                                                                                                                                                                                  | Why                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Minute digits: fill 42 % (dark) / 32 % (light) + 2 px accent stroke                            | Fill raised to **65 % / 75 %**; the 2 px stroke is kept                                                                                                                                                                                                                    | Fill-only contrast was 2.0–2.6 : 1 (dark) and 1.2–1.6 : 1 (light); now ≥ 3 : 1 at the worst case (large text, WCAG 1.4.3)                                                                   |
| Colon alternates opacity 1 ↔ 0.3 every second                                                  | **Static colon** (opacity 1), always                                                                                                                                                                                                                                       | WCAG 2.2.2 (Level A): auto-blinking content > 5 s needs a pause mechanism; removing it is the simplest conformant fix                                                                       |
| Glass surfaces are translucent over an arbitrary image                                         | Each surface family gets a **legibility floor** (an opaque layer under the glass): dark 15 / 35 / 15 %, light 55 / 80 / 90 % (bar / card / clock)                                                                                                                          | Over a dark photo in light theme the clock accent measured 1.5 : 1, muted text 2.4 : 1, status pills ≈ 3 : 1. With floors every text pair is ≥ 4.5 : 1 (large ≥ 3 : 1) against any backdrop |
| Focus ring not drawn                                                                           | Two-tone ring: 2 px `--focus` + 2 px `--focus-halo`                                                                                                                                                                                                                        | Visible on any backdrop in both themes (WCAG 2.4.7, 1.4.11)                                                                                                                                 |
| Sticky dock can take ~45 % of a short viewport, and compaction shrinks the document (≈ 306 px) | Dock only sticks when viewport height ≥ 720 px (desktop) / ≥ 500 px (mobile); **compaction is allowed only if the page still scrolls afterwards** (capacity gating, dead band 80 / 56 px, circuit breaker); `scrollbar-gutter: stable`; `scroll-padding-top` = dock height. **Consequence:** the 10-app sample (2 rows) never compacts, so the mockup's desktop scrolled captures (`dark-2`, `dark-3`, `light-2`, which show 2 rows compacted) are reproduced with ≥ 4 rows (`mockup/README.md`) | WCAG 1.4.10 reflow, 2.4.11 focus not obscured; prevents the flip-flop animation loop on short pages |
| Configurator field borders at 10 % opacity (1.05 : 1)                                          | `--field-border` dark 45 % white / light 55 % dark (≥ 3.5 : 1)                                                                                                                                                                                                             | WCAG 1.4.11 non-text contrast                                                                                                                                                               |

> **Visual cost (accepted, D-f):** in the **light** theme the floors make cards and the clock widget almost opaque white (effective alpha ≈ 0.94–0.96), noticeably less see-through than the mockup. Dark theme is barely affected. Tunable via the three `--floor-*` tokens; the token test fails if a value drops below AA.

## Affected Modules

`src/styles.css`, `src/index.html`, `package.json` (fonts), every component under
`src/app/shared/components/*`, `src/app/views/dashboard/*`, `src/app/features/configurator/*`,
`app-toast`, `ThemeService` (scrim/tokens only), plus one new `ScrollStateService`. No change to `IconService`
(design decision D6), `core/models`, `config.service`, `yaml-*`, `config-write.service`, `server/`.

## Risks

| Risk                                                                                                                                                                                                                                                                                    | Mitigation                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Light-theme floors alter the look (accepted, D-f).                                                                                                                                                                                                                                      | Floors are single tokens; the token test fails if a value drops below AA.                                                                                                                                                                                                                                                                          |
| Sticky dock height vs. small viewports and zoom (WCAG 1.4.10 / 2.4.11).                                                                                                                                                                                                                 | Media-query guards, `scroll-padding-top`, spec scenarios, keyboard walk-through.                                                                                                                                                                                                                                                                   |
| **Animation / state loop on short pages.** Compacting shrinks the document; if the page then cannot scroll, the browser clamps `scrollY`, the state flips back, the dock grows, and it repeats. Simulated: with 2 rows of apps, hysteresis alone flips 40 times in 40 steps (infinite). | Eligibility gated on remaining scroll capacity computed from the Top layout (state-independent), dead band, dwell, `scrollbar-gutter: stable`, `overflow-anchor: none`, circuit breaker; closed-loop fixed-point test and browser smoke with 1–10 rows (`design.md` § 4.1, § 6). Simulated result with gating: 0 flips at 1–3 rows, 1 at ≥ 4 rows. |
| `backdrop-filter` (blur 16–24 px) on ~10+ cards is costly on low-power GPUs.                                                                                                                                                                                                            | Opaque fallback under `@supports not (backdrop-filter)`; measure on a low-end device before merge.                                                                                                                                                                                                                                                 |
| Fonts add assets to the build (measured in `node_modules`: Nunito latin + latin-ext ≈ 75 KB, IBM Plex Mono 3 weights latin + latin-ext ≈ 86 KB, `woff2`).                                                                                                                               | Only the Latin and Latin-Extended subsets are wired; `font-display: swap`; check the build report.                                                                                                                                                                                                                                                 |
| Large visual diff touches every component.                                                                                                                                                                                                                                              | Slice by module; existing specs/tests are the regression net; no behavioural change allowed here.                                                                                                                                                                                                                                                  |
| Mockup is dark-only for the configurator.                                                                                                                                                                                                                                               | Light configurator is derived from the same tokens (D-i); owner reviews it in the implementation PR (D-i).                                                                                                                                                                                                                                         |

## Rollback Plan

Pure presentation change on a feature branch (`feature/ui-redesign`) merged via `develop`. Rollback =
revert the merge commit(s); no data, schema, config, API, or image-contract changes exist to unwind.
`deploy/kubernetes` pins images by digest, so the previous release remains deployable unchanged.

## Success Criteria

1. Every scenario in `specs/**` passes (unit/component tests + the manual visual checks in
   `design.md` § 6).
2. Rendered dashboard at 1440 × 900 (dark, light; the captures are 1440 × 820, compare modulo the vertical crop), 390 × 844 and the scrolled states matches
   `mockup/states/*`, with the data of `mockup/fixture/dashboard.yaml` plus the status stub of `design.md` § 6 (not `public/config/dashboard.yaml`), and with the desktop scrolled states rendered with ≥ 4 rows of apps; the only differences are the declared amendments and the date pill (D-g) (owner review).
3. Axe: 0 violations on `/` and `/configure` in light and dark, desktop and mobile.
4. Token-contrast test passes at the worst-case backdrops for every pair in `design.md` § 5.
5. No change to existing behavioural specs other than the two deltas; `ng test`, `ng lint`,
   `ng build`, `npm run format:check` green.
6. With 1, 2, 3, 4 and 10 rows of apps the dock changes state at most once per scroll direction and no animation is running at rest (closed-loop test + browser smoke).
7. Lighthouse (desktop) performance not worse than the current build by more than 5 points on the
   same sample config.

## Open Questions

None pending. `tasks.md` is written; next step is owner approval of it (task 0.4), then implementation starting at Phase 1.
