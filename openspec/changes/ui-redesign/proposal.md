# Proposal: UI Redesign — "Consola"

## Intent

Replace the current frosted-glass-on-photo look with the **"Consola"** design: a sober, instrument-panel
aesthetic for a homelab dashboard — warm-neutral surfaces, a single amber accent, Nunito for UI text
and IBM Plex Mono for data (tags, status, dates, version), a large split-style clock, and a refined
glass treatment that stays legible over any user background image. The dashboard and the YAML
configurator are redesigned together so they read as one product.

Reference: `mockup/` (artboards: dark, light, mobile dashboard; configurator). It is the single source
of visual truth; this change turns it into testable requirements.

## Scope

### In Scope

- A **design system** layer: colour/typography/radius/shadow/blur tokens for light and dark themes,
  web fonts, surface ("glass") recipes, focus ring, motion rules, contrast guarantees.
- **Dashboard** redesign (`/`): header chip + action buttons, split-style clock with weekday/date
  pills, search bar with engine selector, underline category tabs, horizontal app cards with status
  pill, footer bar, empty/loading states, responsive layout (desktop grid → single-column mobile).
- **Scroll behaviour** from the mockup: sticky header band with blur, compact clock row and shrunken
  search on desktop; sticky search band on mobile.
- **Configurator** redesign (`/configure`): page header, numbered side navigation, section cards,
  switch controls, inline validation panel, inline app editor, export panel — same capabilities as today.
- Light/dark/auto theming continues to work; background images + scrim continue to work (retinted).
- Update `README.md`, `ARCHITECTURE.md`, `screenshots/*`, `CHANGELOG.md`.

### Out of Scope

- Any change to the YAML schema, `config-write-api`, `app-status-check` server behaviour, health-check
  cadence, or routing.
- New product features invented by the mockup tweak props (`accent` picker, `clockStyle: classic`,
  user-adjustable overlay opacity) — unless resolved otherwise in the open questions below.
- The clock explorations E–J (glass flip tiles, Outfit Thin, Anton stack, Jakarta gradient, Jost Thin,
  Bricolage) — alternatives that were not selected.
- Configurator layouts below 900 px beyond what the mockup's embedded rules define; tablet breakpoints
  for the dashboard (not mocked — kept on the current `md`/`lg`/`xl` ladder).
- Replacing Tailwind or the icon libraries.

## Capabilities

Scope check (spec-driven-development, Phase 0): the request bundles independently testable
capabilities, so this change is decomposed by module id. Module ids are stable.

| Module id           | Responsibility                                                          | Depends on      |
| ------------------- | ----------------------------------------------------------------------- | --------------- |
| `design-system`     | Tokens, fonts, surfaces, theming, motion, focus, contrast guarantees    | —               |
| `dashboard-ui`      | Dashboard layout and components, scroll behaviour, responsive behaviour | `design-system` |
| `yaml-configurator` | Configurator layout and controls (delta on the existing capability)     | `design-system` |
| `app-status-check`  | Status badge presentation only (delta on the existing capability)       | `dashboard-ui`  |

Build order: `design-system` → `dashboard-ui` ∥ `yaml-configurator` → `app-status-check` badge delta
(lands with the card in `dashboard-ui`).

### New Capabilities

- `design-system` — see `specs/design-system/spec.md`.
- `dashboard-ui` — see `specs/dashboard-ui/spec.md`.

### Modified Capabilities

- `yaml-configurator` — presentation requirements added/modified; behaviour untouched
  (`specs/yaml-configurator/spec.md`).
- `app-status-check` — requirement "Status badge is accessible" modified: the non-colour cue changes
  from a check/cross glyph to a text label (`UP` / `DOWN`) (`specs/app-status-check/spec.md`).

## Affected Modules

`src/styles.css`, `src/index.html`, `angular.json` (fonts), every component under
`src/app/shared/components/*`, `src/app/views/dashboard/*`, `src/app/features/configurator/*`,
`ThemeService` (scrim/tokens only), plus one new `ScrollStateService`. No change to `IconService`
(design decision D6), `core/models`, `config.service`, `yaml-*`, `config-write.service`, `server/`.

## Risks

| Risk                                                                                                                                                                     | Mitigation                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Minute digits render as 42 % (dark) / 32 % (light) alpha fill + 2 px accent stroke; fill-only contrast is 2.63:1 / 1.56:1 (< 3:1). Axe cannot see `-webkit-text-stroke`. | Spec requires the stroke colour to meet ≥ 3:1 (measured 8.96:1 / 5.11:1) and a token-contrast unit test; manual visual check in both themes. |
| Colon pulses (opacity 1 ↔ 0.3 every second): WCAG 2.2.2 (Level A) applies to auto-blinking content.                                                                      | Static under `prefers-reduced-motion`; open question Q5 proposes removing the pulse.                                                         |
| Sticky header can obscure focused elements (WCAG 2.4.11, AA).                                                                                                            | `scroll-padding-top` tied to the live header height; covered by a spec scenario.                                                             |
| `backdrop-filter` (blur 16–24 px) on ~10+ cards is costly on wall tablets / low-power GPUs.                                                                              | Opaque fallback tokens under `@supports not (backdrop-filter)`; measure on a low-end device before merge.                                    |
| Text over glass depends on the user's background image; contrast is only guaranteed against the scrim.                                                                   | Scrim opacities fixed by tokens (dark 0.6, light 0.2); background images remain user-configurable; documented limit.                         |
| New web fonts add a render-blocking / privacy dimension (Google Fonts) in a self-hosted product.                                                                         | Decision D3: self-host via npm packages — requires approval because it adds dependencies.                                                    |
| Large visual diff touches every component; regressions in the existing a11y/behaviour tests.                                                                             | Slice by module; existing specs/tests are the regression net; no behavioural change is allowed in this change.                               |

## Rollback Plan

Pure presentation change on a feature branch (`feature/ui-redesign`) merged via `develop`. Rollback =
revert the merge commit(s); no data, schema, config, API, or image-contract changes exist to unwind.
If shipped behind the next minor release, the previous tag's image remains deployable unchanged
(`deploy/kubernetes` pins by digest).

## Success Criteria

1. Every scenario in `specs/**` passes (unit/component tests + the manual visual checks listed in
   `design.md` § Verification).
2. Rendered dashboard at 1440 × 1000 (dark, light) and 390 × 844 matches the mockup artboards with the
   same sample data (visual diff reviewed by the owner).
3. Axe: 0 violations on `/` and `/configure` in light and dark, desktop and mobile viewports.
4. Token contrast test passes for every text/background pair in `design.md` § Contrast.
5. No change to existing behavioural specs other than the two deltas above; `ng test`, `ng lint`,
   `ng build`, `npm run format:check` green.
6. Lighthouse (desktop) performance not worse than the current build by more than 5 points on the
   same sample config.

## Open Questions (need owner decision — see also `design.md` § Decisions)

- **Q1 Fonts** — self-host Nunito + IBM Plex Mono through npm (adds `@fontsource*` dependencies)
  **(recommended)**, or load from Google Fonts as the mockup does?
- **Q2 Date pill vs `dateFormat`** — the mockup shows `TUESDAY` + `13 OCTOBER` (no year) while the
  configurator sample shows `dateFormat: d MMMM yyyy`. Keep the setting driving the date pill
  **(recommended)** or fix the pill format?
- **Q3 Seconds** — `showSeconds` is not drawn in the mockup. Render a small seconds readout beside
  the minutes **(recommended)**, or drop the setting?
- **Q4 Clock variants / accent** — ship only the mockup default (`split`, amber)? The prototype also
  has `clockStyle: classic` and four accent colours; the E–J explorations are not chosen.
- **Q5 Colon pulse** — keep (reduced-motion guarded) or make static to satisfy WCAG 2.2.2
  **(recommended: static)**?
- **Q6 Page scroll model** — the mockup scrolls the whole page (sticky header, footer at the end of
  the flow). Today the header/footer are fixed and only the grid scrolls. Adopt the mockup model
  **(recommended)**?
- **Q7 Configurator < 900 px** — only the embedded media rules are known (side nav becomes a
  horizontal chip bar). Accept as specified?
- **Q8 Status badge** — replace the check/cross circle with a text pill (`● UP` / `● DOWN`) as drawn,
  which requires the `app-status-check` delta?
