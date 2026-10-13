# Mockup reference — "Mando — rediseño Consola"

Source: Claude Design artifact `https://claude.ai/artifact/Efp359DpxLHxZ7Ryxt3f77` (public, read-only).
Captured 2026-10-13 from the **live prototype** (artboards played full screen: theme toggle, scroll,
search, engine menu, hover, configurator via the `Open configurator` link). This folder is a
**reference snapshot**; the specs in `../specs/` and `../design.md` are the normative documents.

## Artboards in the canvas

| Artboard                    | Interactive in the prototype                                                                    | Used                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Dashboard · oscuro          | yes — theme toggle (dark ⇄ light), scroll, search, engine menu, hover; link to the configurator | yes                                                                       |
| Dashboard · claro           | yes (same component, light by default)                                                          | yes (covered by the toggle)                                               |
| Dashboard · móvil           | yes — 390 px, `compact` layout                                                                  | yes                                                                       |
| Configurator                | yes — scroll-spy nav, inline editor; **dark only** (theme button not wired)                     | yes                                                                       |
| Reloj · exploraciones (E–J) | n/a — typographic studies to choose the clock                                                   | **no** (discarded; the split clock of the dashboard artboards was chosen) |

## `states/` — screenshots of the live prototype

| Files                                      | State                                                                                                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dark-1-top` … `dark-7-card-hover`         | Dashboard, dark, 1440 × 820: top; scrolled (sticky dock, compact clock, 440 px search); search expanded; engine menu; query with results; empty state; card hover |
| `light-1-top` … `light-4-empty-state`      | Dashboard, light: top; scrolled; engine menu; empty state                                                                                                         |
| `mobile-0-top`, `mobile-1-scrolled` … `mobile-4-light-scrolled` | Dashboard, 390 px. `mobile-0-top` (dark) is rendered from the frozen `html/dashboard-mobile.html` at 390 × 844, scroll 0: header, 88 px clock, search, tabs, first cards. `mobile-1-scrolled`, `mobile-2-scrolled` (dark) and `mobile-4-light-scrolled` (light): sticky search + tabs. **No light Top capture exists** (the prototype's one was blank and was removed). |
| `config-1-top` … `config-5-export`         | Configurator, dark, 1440: top (starting point + validation panel); scrolled settings; categories/applications rows; inline editor; export + token panel           |
| `config-6-800-*`, `config-7-800-*`         | Configurator at 800 px: chip-bar navigation                                                                                                                       |
| `config-8-390-*`, `config-9-390-*`         | Configurator at 390 px: icon-only back button, chip bar                                                                                                           |

The background photos (aurora in dark, mountains in light) are the prototype's sample images, standing
in for the user-configured `darkBackgroundImage` / `lightBackgroundImage`.

## `html/` — rendered sources

Serialized DOM of each artboard iframe, with the Claude Design runtime. Do **not** lift markup from
it. It is kept because the embedded `<script type="text/x-dc">` component (`renderVals()` and the
scroll/hover handlers) holds the exact tokens, thresholds and state transitions that `../design.md`
transcribes. `html/_blob/` has the sample assets (logos, icons, backgrounds) the HTML references; serve
the folder statically (`python3 -m http.server --directory html`) to open it. The copies are frozen
snapshots (the clock does not tick, no interactivity) — use the live artifact for behaviour.

## Reproducing the captures (read before visual sign-off)

- **Sample data.** The captures do **not** use `public/config/dashboard.yaml` as is: the dashboard artboards
  show the date pills (`showDate: true`) and status pills on 8 apps (7 `UP`, Mosquitto `DOWN`), and the
  configurator draft has `Theme: Dark`. `fixture/dashboard.yaml` reproduces that data; the status values
  come from a stub of `GET /api/status` (`../design.md` § 6, _Verification fixture_). The date pill in the
  build reads `13 OCTOBER 2026` (it follows `dateFormat`, decision D-g), not the mockup's `13 OCTOBER`.
- **Desktop scrolled states** (`dark-2`, `dark-3`, `light-2`) show the compact dock with only 2 rows of
  apps, because the artboard has no capacity gating. In the build, 2 rows never compact (`design.md`
  § 4.1, D14), so these three states are reproduced with a fixture of **≥ 4 rows** (e.g. the 10 apps
  duplicated to 20 with new ids), not with the 10-app sample. The mobile states are unaffected (one column).
- **Viewport.** The 1440-wide captures were taken at 1440 × 820; compare modulo the vertical crop.
- **Rendering artefacts to ignore.** Rectangular seams in the clock widget (≈ x 948) and a vertical seam in the
  scrolled band (≈ x 1230) come from headless backdrop-filter rasterising; they are not design.
- **Footer heart.** `dark-2` draws an amber outline ♡, `config-5` a plain filled ♥; the build uses ♡ (spec).

## Notes

- Fonts load from Google Fonts in the mockup (`Nunito`, `IBM Plex Mono`); the app self-hosts them
  (`design.md` D3).
- The mockup's tweakable props (`dark`, `accent`, `compact`, `clockStyle`, `showDescriptions`,
  `showLabels`, `overlayDark`, `overlayLight`) are design-time knobs, not product settings.
- Known deviations from the mockup (accessibility): `../proposal.md` § Accessibility amendments.
