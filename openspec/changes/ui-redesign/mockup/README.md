# Mockup reference — "Mando — rediseño Consola"

Source: Claude Design artifact `https://claude.ai/artifact/Efp359DpxLHxZ7Ryxt3f77` (public, read-only).
Captured 2026-10-13. Everything in this folder is a **reference snapshot**; the specs in
`../specs/` and `../design.md` are the normative documents.

## Artboards

| Artboard (canvas title)     | Viewport    | Screenshot               | Rendered source                | Status in this change                          |
| --------------------------- | ----------- | ------------------------ | ------------------------------ | ---------------------------------------------- |
| Dashboard · oscuro          | 1440 × 1000 | `dashboard-dark.png`     | `html/dashboard-dark.html`     | Normative (dark theme, desktop)                |
| Dashboard · claro           | 1440 × 1000 | `dashboard-light.png`    | `html/dashboard-light.html`    | Normative (light theme, desktop)               |
| Dashboard · móvil           | 390 × 844   | `dashboard-mobile.png`   | `html/dashboard-mobile.html`   | Normative (dark theme, compact layout)         |
| Configurator                | 1440 × full | `configurator.png`       | `html/configurator.html`       | Normative (dark theme, desktop)                |
| Reloj · exploraciones (E–J) | 1440 × 1000 | `clock-explorations.png` | `html/clock-explorations.html` | **Not selected** — alternatives, see design.md |

## How to read the HTML snapshots

- Each `html/*.html` is the serialized DOM of the artboard iframe, including the Claude Design editor
  chrome and runtime scripts. Do **not** lift markup from it; the design logic is in the embedded
  `<script type="text/x-dc">` component (`renderVals()`), which holds the exact tokens, thresholds and
  state transitions that `../design.md` transcribes.
- Fonts load from Google Fonts in the mockup (`Nunito`, `IBM Plex Mono`); the app does not use web
  fonts today (see design.md, decision D3).
- Broken-image glyphs in the screenshots (top-left corner, Plex / Nextcloud / Home Assistant /
  Portainer icons, header logo) are blob assets that did not resolve outside the editor. They are not
  part of the design: the real app resolves icons through `IconService` and the logo from `img/mando.png`.
- Screenshots were rendered headless at the stated viewport via a local static server; scroll-driven
  states (compact header) are not visible in them — they are specified from the source script.
- The mockup's tweakable props (`dark`, `accent`, `compact`, `clockStyle`, `showDescriptions`,
  `showLabels`, `overlayDark`, `overlayLight`) are design-time knobs, not product settings, unless
  `../design.md` says otherwise.
