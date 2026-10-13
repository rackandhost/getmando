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
| `mobile-1-top` … `mobile-4-light-scrolled` | Dashboard, 390 px, dark and light: top; scrolled (sticky search + tabs)                                                                                           |
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

## Notes

- Fonts load from Google Fonts in the mockup (`Nunito`, `IBM Plex Mono`); the app self-hosts them
  (`design.md` D3).
- The mockup's tweakable props (`dark`, `accent`, `compact`, `clockStyle`, `showDescriptions`,
  `showLabels`, `overlayDark`, `overlayLight`) are design-time knobs, not product settings.
- Known deviations from the mockup (accessibility): `../proposal.md` § Accessibility amendments.
