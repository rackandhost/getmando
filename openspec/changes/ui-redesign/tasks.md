# Tasks: UI Redesign — "Consola"

Spec: `specs/**` · Design: `design.md` · Mockup: `mockup/states/*`.
Strict TDD (`openspec/config.yaml`): every task lists its **RED** test first; the task is done when
that test is green and the rest of the suite is unchanged.

## Review Workload Forecast

Line counts are estimates **[INFERENCE]** (≈ 55 % tests/specs, 45 % code/CSS/templates).

| Field                   | Value                                                                      |
| ----------------------- | -------------------------------------------------------------------------- |
| Estimated changed lines | 4 000–4 800 (plus ≈ 13 MB of mockup assets already committed)              |
| 400-line budget risk    | **High** — one PR would be unreviewable                                    |
| Chained PRs recommended | **Yes**, 4 stacked PRs, one commit per task                                |
| Suggested split         | PR 1 → PR 2 ∥ PR 3 → PR 4                                                  |
| Delivery strategy       | ask-on-risk                                                                |
| Chain strategy          | stacked on `feature/ui-redesign`; PR 2 and PR 3 are independent after PR 1 |

Decision needed before apply: **None** — all open questions are resolved (`proposal.md` §
Decisions taken). Approval of this task list is the only gate (task 0.4).

### Suggested Work Units

| Unit | Goal                                                                  | Phase | Focused test command                                                                                                      | Rollback boundary                                                 |
| ---- | --------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| PR 1 | Tokens, fonts, surfaces, base layer, loop-free scroll-state service   | 1     | `ng test --include='src/app/core/scroll/**/*.spec.ts' --include='src/styles/**/*.spec.ts' --watch=false --coverage=false` | Revert PR; app unchanged visually until PR 2/3 consume the tokens |
| PR 2 | Dashboard (`/`) redesign incl. sticky dock and status pill            | 2     | `ng test --include='src/app/shared/**/*.spec.ts' --include='src/app/views/**/*.spec.ts' --watch=false --coverage=false`   | Revert PR; configurator keeps working with PR 1 only              |
| PR 3 | Configurator (`/configure`) redesign incl. scroll-spy and chip bar    | 3     | `ng test --include='src/app/features/configurator/**/*.spec.ts' --watch=false --coverage=false`                           | Revert PR                                                         |
| PR 4 | Verification report, screenshots, README/ARCHITECTURE, spec promotion | 4     | full `ng test`, `ng lint`, `ng build`, `npm run format:check`                                                             | Revert docs; archive step is separate                             |

## Verification Environment

- Unit/component: Vitest + `@testing-library/angular` + jsdom (`ng test`). jsdom has **no layout**,
  so everything that depends on geometry is split into a **pure function** (unit-tested) and a thin
  Angular wrapper (tested with stubbed metrics).
- `axe-core` runs through `src/testing/a11y.ts` with `color-contrast` **disabled** (jsdom cannot
  compute it). Contrast is therefore guaranteed by the **token audit** (task 1.2), not by axe.
- No e2e framework exists (`openspec/config.yaml`): browser checks are throwaway smoke runs with
  `ng serve` + the browser tool, recorded in `verify-report.md` (task 4.6). **No source-text tests**:
  CSS-only rules (scrim, gutter, anchoring, transitions) are verified by smoke, not by grepping files.
- Focused runs need a **spec glob** and no coverage gate (verified: a bare directory glob pulls in `.html` files and fails to bundle):
  `ng test --include='<dir>/**/*.spec.ts' --watch=false --coverage=false`. The full run keeps the repo's coverage threshold.
- Pre-merge gates for every PR: `npm run check:focused-tests`, `npm run lint`, `tsc --noEmit`
  (via `ng build`), `npm run format:check`, `ng test --watch=false` (with coverage), `ng build`.
- Commit per task, conventional commits (`feat(ui):`, `test(ui):`, `docs(openspec):`); no `fit`/`fdescribe`.

## Contracts (fixed before parallel work)

```ts
// src/app/core/scroll/scroll-state.ts — pure, no Angular
export type ChromeMode = 'static' | 'top' | 'scrolled';
export interface ScrollInput {
  scrollY: number; docHeight: number; viewportHeight: number; delta: number; // px
  mode: ChromeMode; eligible: boolean; guardOk: boolean;
}
export const ENTER = 40, EXIT = 4, ELIGIBLE_ON = 80, ELIGIBLE_OFF = 56;
export function remainingCapacity(i: Pick<ScrollInput,'docHeight'|'viewportHeight'|'delta'|'mode'>): number;
export function nextEligible(prev: boolean, r: number): boolean;
export function nextMode(i: ScrollInput): ChromeMode;

// src/app/core/scroll/scroll-state.service.ts — providedIn: 'root'
export interface ChromeProbe { id: string; compactDelta: () => number; minViewportHeight: number }
export interface ChromeHandle { readonly mode: Signal<ChromeMode>; dispose(): void }
register(probe: ChromeProbe): ChromeHandle;
```

Files introduced: `src/styles/{tokens,fonts,base,surfaces}.css`, `src/testing/{contrast,token-audit,scroll-sim}.ts`,
`src/app/core/scroll/*`, `src/app/shared/directives/sticky-dock.directive.ts`.

---

## Phase 0: Preparation

- [x] 0.1 Create `feature/ui-redesign` from `develop`.
- [x] 0.2 Capture the live mockup (`mockup/`), write proposal, design and delta specs.
- [x] 0.3 Install `@fontsource-variable/nunito` and `@fontsource/ibm-plex-mono` (commit `b0ba596`).
- [x] 0.4 **Gate:** owner approves this task list (approved 2026-10-13).
- [x] 0.5 Baseline from `develop` **before any UI change**: Lighthouse desktop + mobile on the sample
      config, `ng build` output sizes, and 5 reference screenshots. Record in `verify-report.md`
      (stub). Verify: numbers present for performance, bundle size and dist asset list.
      Files: `openspec/changes/ui-redesign/verify-report.md`, `baseline/*`.
      → Done: desktop 84 / mobile 62 performance, initial bundle 745.32 kB (already over the
      500 kB warning budget), 5 screenshots, 2 pre-existing a11y findings recorded (see report § 1).

## Phase 1: Foundation — design system and scroll state (PR 1)

- [ ] 1.1 **Contrast library.** Spec: `design-system` § Contrast guarantees.
  - RED `contrast.spec.ts`: `contrastRatio('#000','#fff') = 21`; alpha compositing
    (`rgba(240,176,74,.42)` over `#171A1E`); relative luminance; known mockup pairs reproduce
    2.63 / 1.56 (the numbers in `design.md` § 5 "before").
  - GREEN `contrast.ts`: `parseColor`, `compositeOver`, `luminance`, `contrastRatio`.
  - Verify: `ng test --include='src/testing/**/*.spec.ts' --watch=false --coverage=false`. Files: `src/testing/contrast.ts`, `contrast.spec.ts`. Scope S.
- [ ] 1.2 **Tokens + token audit.** Spec: `design-system` § Theme tokens, § Contrast guarantees,
      § UI component boundaries. Depends 1.1.
  - RED `design-tokens.spec.ts`: (a) every token of `design.md` § 3.1/3.2 has its exact value in
    light (`:root`) and dark (`.dark`); (b) `auditTokens(css)` returns **no violations** for every pair
    of `design.md` § 5 (worst case: black/white backdrops, floor + glass top/bottom stops), including
    minute fill ≥ 3, field border ≥ 3, focus ring ≥ 3; (c) a doctored copy of the CSS with
    `--floor-card` (light) lowered makes `auditTokens` fail and **names the pair and theme**.
  - GREEN `tokens.css` (+ `@theme inline` registration for utilities), `token-audit.ts`, import in `styles.css`.
  - Verify: `ng test --include='src/styles/**/*.spec.ts' --include='src/testing/**/*.spec.ts'`; `ng build` still green.
  - Files: `src/styles/tokens.css`, `src/styles.css`, `src/testing/token-audit.ts`,
    `src/styles/design-tokens.spec.ts`. Scope M.
- [ ] 1.3 **Self-hosted fonts.** Spec: `design-system` § Typography and self-hosted fonts. Depends 0.3.
  - Spike first: can the Angular build resolve `@fontsource*/files/*.woff2` from `url()`? If not,
    copy the 4 + 6 `woff2` files into `public/fonts/` with a documented script.
  - RED `fonts.spec.ts`: the font CSS declares only `latin` and `latin-ext` faces for
    `'Nunito Variable'` and `'IBM Plex Mono'` (400/500/600), every `src` is a relative URL (no
    `http(s)://`), every face has `font-display: swap`.
  - GREEN `fonts.css`; `font-family` stacks in tokens (`--font-sans`, `--font-mono`).
  - Verify: `ng build`; list `dist/**/*.woff2` (≤ 10 files, no cyrillic/greek/vietnamese); browser
    network panel shows 0 third-party requests; fonts render (screenshot).
  - Files: `src/styles/fonts.css`, `src/styles.css`, `src/styles/fonts.spec.ts` (+ `public/fonts/*` only if the spike requires). Scope S–M.
- [ ] 1.4 **Base layer.** Spec: `design-system` § Background and scrim, § Focus indicator, § Motion,
      § Scroll-state stability rule 6. Depends 1.2.
  - RED: the token audit already covers focus-ring contrast; add the **reduced-motion** and scrim
    behaviour as a smoke checklist in `verify-report.md` (no source-text test).
  - GREEN `base.css`: tinted `--scrim` replacing `body:after`; `#app-background` (`cover`,
    `saturate(.85)`); `html { scrollbar-gutter: stable }`; `overflow-anchor: none` utility; two-tone
    focus ring; `prefers-reduced-motion` turns off the redesign's transitions; remove the old
    scrollbar/focus rules superseded here.
  - Verify: browser — both themes show the image under the 0.6 / 0.2 scrim; Tab shows the two-tone
    ring on a dark and a light backdrop; toggling OS reduced motion disables transitions.
  - Files: `src/styles/base.css`, `src/styles.css`. Scope S.
- [ ] 1.5 **Surface recipes.** Spec: `design-system` § Glass surfaces with a legibility floor. Depends 1.2, 1.4.
  - RED: extend `token-audit` spec so each recipe's declared floor token is the one audited
    (`bar`, `card`, `clock`) and a surface without a floor fails the audit.
  - GREEN `surfaces.css`: `@utility glass-chrome | glass-card | glass-field | glass-clock` =
    floor layer + gradient + inset highlights + blur; `@supports not (backdrop-filter: blur(1px))`
    opaque fallback.
  - Verify: throwaway fixture (not committed) with a card, bar and clock over black, white and the
    sample photos in both themes; screenshots reviewed against `mockup/states/*`.
  - Files: `src/styles/surfaces.css`, `src/styles.css`, `src/testing/token-audit.ts`, spec. Scope M.
- [ ] 1.6 **Scroll-state pure core.** Spec: `design-system` § Scroll-state stability. **Highest risk —
      do first of the logic tasks.**
  - RED `scroll-state.spec.ts`: hysteresis (41 → scrolled, 5 stays scrolled, 4 → top); eligibility
    dead band (on at `R ≥ 80`, off at `R < 56`); the worked-example table of `design.md` § 4.1 for 1…8
    rows (static, static, static, eligible …); viewport guard forces `static`; **closed-loop
    fixed-point test** using `scroll-sim.ts` (document height depends on mode, `scrollY` clamped):
    for rows 1…12, viewport heights 500…1200, Δ ∈ {10, 16, 306}, random scroll intents and random
    content/viewport changes, holding the input constant converges within 2 iterations and a single
    input change causes ≤ 1 mode change.
  - GREEN `scroll-state.ts`, `scroll-sim.ts`.
  - Verify: `ng test --include='src/app/core/scroll/**/*.spec.ts' --watch=false --coverage=false`. Files: `scroll-state.ts`, `scroll-state.spec.ts`, `src/testing/scroll-sim.ts`. Scope M.
- [ ] 1.7 **`ScrollStateService`.** Spec: `design-system` § Scroll-state stability rules 1–7. Depends 1.6.
  - RED `scroll-state.service.spec.ts` (fake timers, injected `MetricsSource` token for
    scrollY/doc/viewport/media): `register()` returns a mode signal; scroll → `scrolled` after one rAF;
    clamp-induced `scrollY` drop right after compaction does **not** flip back; observer callbacks only
    schedule a rAF (never change mode synchronously); dwell blocks changes for 400 ms (0 under reduced
    motion); **breaker**: 5 changes in 2 s ⇒ `static`, one `LoggerService` entry, no
    `NotificationService` call, released on viewport/content-height change; `dispose()` removes listeners.
  - GREEN `scroll-state.service.ts` (passive `scroll`, `ResizeObserver`, `matchMedia` guards), `metrics-source.ts`.
  - Verify: `ng test --include='src/app/core/scroll/**/*.spec.ts' --watch=false --coverage=false`; `tsc` strict. Files: service, spec, `metrics-source.ts`. Scope M.
- [ ] 1.8 **`StickyDockDirective`.** Spec: `design-system` § Focus under a sticky bar (D9, D13). Depends 1.7.
  - RED `sticky-dock.directive.spec.ts`: host gets `data-dock="static|top|scrolled"` from the handle
    mode; `--dock-height` is updated (rAF) when the host height changes; `document.documentElement`
    receives `scroll-padding-top` equal to it while the dock is sticky and none while `static`;
    cleans up on destroy.
  - GREEN directive (host bindings in `host: {}`, no `@HostBinding`).
  - Files: `sticky-dock.directive.ts`, spec. Scope S.

### Checkpoint 1 — Foundation (end of PR 1)

- [ ] `ng test --watch=false`, `npm run lint`, `ng build`, `npm run format:check`, `npm run check:focused-tests` green.
- [ ] Token audit and closed-loop test green; fonts load with 0 third-party requests; dist size recorded.
- [ ] Existing screens still render (only base layer changed) — smoke on `/` and `/configure`.
- [ ] Review with owner before PR 2 / PR 3.

## Phase 2: Dashboard (PR 2) — depends on Checkpoint 1

- [ ] 2.1 **Shell restructure.** Spec: `dashboard-ui` § Page structure. Contract change: `app-header`
      moves from the shell into each view so the dock can wrap it.
  - RED `app-shell.component.spec.ts` (new): landmarks and DOM order — outlet content then footer in
    flow; no inner scroll container; `app-header` is rendered by the dashboard and configurator views.
  - GREEN shell no longer wraps header / `h-dvh overflow-hidden`; footer in flow; `dashboard.component.html`
    and `configurator-page.component.html` render `<app-header>`.
  - Files: `app-shell.component.{ts,html}`, `app-shell.component.spec.ts`, `dashboard.component.html`, `configurator-page.component.html`. Scope M.
- [ ] 2.2 **Header chip and buttons.** Spec: `dashboard-ui` § Header.
  - RED update `app-header.component.spec.ts`: names `Open configurator` / `Back to dashboard` / `Toggle theme`
    unchanged, title/description fallbacks, icons `aria-hidden`, routes unchanged.
  - GREEN markup/styles with tokens and recipes.
  - Files: `app-header.component.{html,ts}`, spec. Scope S.
- [ ] 2.3 **Footer bar.** Spec: `dashboard-ui` § Footer.
  - RED `app-footer.component.spec.ts`: `Powered by Mando v<version>` links, `Created with ♡ by Rack&Host <year>`
    link, heart has accessible name `love`.
  - GREEN glass bar in flow, Plex Mono 12 px.
  - Files: `app-footer.component.{html,ts}`, spec. Scope S.
- [ ] 2.4 **Clock widget.** Spec: `dashboard-ui` § Clock widget (Q2/Q3 resolved).
  - RED `app-clock.component.spec.ts`: `HH:mm` digits split into hours / colon / minutes; weekday
    pill = weekday, date pill = `dateFormat` uppercased (`d MMMM yyyy` → `13 OCTOBER 2026`, `dd/MM` changes only the date pill);
    `datePosition` top/bottom; `showDate:false` hides both; `showSeconds` renders a `aria-hidden`
    seconds node and `false` renders none; colon has no blinking class/animation across ticks (fake
    timers 10 s); widget is not `aria-live`.
  - GREEN markup (`-webkit-text-stroke`, `--minute-fill`), small `clock-format.ts` if useful.
  - Files: `app-clock.component.{html,ts}`, spec (+ `clock-format.ts`). Scope M.
- [ ] 2.5 **Search bar.** Spec: `dashboard-ui` § Search bar.
  - RED `app-finder.component.spec.ts`: accessible name `Search applications`; placeholder
    `Search your applications…` / `Search on <engine>…`; clear + accent submit buttons appear only with a
    query, clear empties it; Enter submits to the selected engine (existing behaviour kept).
  - GREEN single glass bar layout.
  - Files: `app-finder.component.{html,ts}`, spec. Scope S–M.
- [ ] 2.6 **Engine menu (listbox).** Spec: `dashboard-ui` § Engine menu.
  - RED `app-search-engine-selector.component.spec.ts`: button `aria-expanded`; `listbox`/`option`
    roles; first option `Your apps`; selected option has a check; Enter/Space opens, arrows move, Enter
    selects and returns focus to the button; Escape/outside click closes without changing the engine.
  - GREEN markup + keyboard handling.
  - Files: `app-search-engine-selector.component.{html,ts}`, spec. Scope M.
- [ ] 2.7 **Category tabs.** Spec: `dashboard-ui` § Category tabs.
  - RED `app-categories.component.spec.ts`: `aria-pressed` on the selected tab; with a query all tabs
    are disabled and none pressed; overflow container does not wrap (class contract via role, not source text).
  - GREEN full-width glass bar, underline selection, dim at 0.45 while searching.
  - Files: `app-categories.component.{html,ts}`, spec. Scope S.
- [ ] 2.8 **App card + status pill.** Spec: `dashboard-ui` § App card; `app-status-check` delta (D-k).
  - RED `app-card.component.spec.ts`: icon tile with `alt`; description/tags follow `showDescriptions` /
    `showLabels`; status pill text `UP` / `DOWN` only when `healthCheck` and a result exists, and it is
    `aria-hidden`; the link (`a[href]`) contains only the app name and is named `<name>` / `<name>, online` /
    `<name>, offline`; **its accessible name contains its visible text**; `aria-describedby` points to the
    description and tag list; `openNewTab` ⇒ `target="_blank"` + `rel="noopener noreferrer"`; `appClick` still
    emitted; the old `Open <name>, currently up|down` is gone.
  - GREEN stretched-link markup (`::after` over the card), horizontal card layout, mono tags, status pill
    (remove the circular glyph badge and its icons); hover/focus visuals on the card via `:has()`.
  - Verify: focused spec; **real-browser axe with the experimental `label-content-name-mismatch` rule enabled**
    on the 10 cards = 0 violations (jsdom cannot evaluate that rule); click on description/tag/empty area
    activates the link; Tab shows the ring around the whole card.
  - Files: `app-card.component.{html,ts}`, spec. Scope M.
- [ ] 2.9 **Grid, empty and loading states.** Spec: `dashboard-ui` § App grid and empty state.
  - RED `dashboard.component.spec.ts`: empty state shows the dashed card with `No applications found`
    - existing copy and no emoji; tabs dimmed while searching; columns driven by `itemsPerRow`
      (existing `xl:grid-cols-N` mapping preserved).
  - GREEN grid gap 14, empty-state markup, loading kept.
  - Files: `dashboard.component.{html,ts}`, spec, `app-loading.component.ts`. Scope S.
- [ ] 2.10 **Toast.** Spec: `design-system` § Notification toasts (owner decision D-l; fixes the baseline `aria-prohibited-attr`).
  - RED `app-toast.component.spec.ts`: the stack container is `role="group"` named `Notifications`; axe (with
    `aria-prohibited-attr`) reports 0 violations for a full stack; errors stay `role="alert"`, other levels
    `role="status"`; level text label rendered; dismiss focus management and the 5-notification stack limit unchanged
    (the existing tests stay green); toast surface uses the card recipe so `token-audit` covers its text pair
    (`text/card`, `muted/card`).
  - GREEN restyle `app-toast.component.{html,css}` with tokens and the `glass-card` recipe (drop the per-theme
    hard-coded colours and `:host-context(.dark)` rules); keep position (top-right; full width at ≤ 640 px), `z-index: 1000`.
  - Verify: `ng test --include='src/app/shared/components/app-toast/**/*.spec.ts' --watch=false --coverage=false`;
    browser — trigger each level in both themes over the dark and the light photo; Lighthouse accessibility no longer
    lists `aria-prohibited-attr`.
  - Files: `app-toast.component.{html,css,ts}`, spec. Scope S.
- [ ] 2.11 **Desktop dock + compact states.** Spec: `dashboard-ui` § Sticky dock (desktop), § Compact clock;
      `design-system` § Scroll-state stability. Depends 2.2, 2.4, 2.5, 2.7, 1.8.
  - RED `dashboard.component.spec.ts` (stubbed `ScrollStateService`): header, clock, search and tabs sit
    inside one `[data-dock]` container; `data-dock` follows the handle mode; in `scrolled` the clock
    switches to its compact variant (seconds stay), search gets the compact variant and expands when
    focused / has a query / engine menu open; in `static` nothing is compact; probe registers
    `compactDelta` = measured top height − `--dock-compact-height` token.
  - GREEN dock wrapper with `appStickyDock`, band/blur/shadow tokens, compact styles for clock/search/tabs gap.
  - Files: `dashboard.component.{html,ts}`, `app-clock.component.html`, `app-finder.component.html`, spec. Scope M.
- [ ] 2.12 **Mobile dock + guards.** Spec: `dashboard-ui` § Mobile sticky dock. Depends 2.11.
  - RED: at the mobile layout the dock wraps only search + tabs (stubbed `matchMedia`), registers Δ = 16,
    clock does not collapse, `static` when the guard fails (viewport < 500 px high).
  - GREEN responsive wrapper (single template, CSS decides which block is the dock).
  - Files: `dashboard.component.{html,ts}`, spec. Scope S–M.
- [ ] 2.13 **Dashboard a11y and regression net.** Spec: `dashboard-ui` § Accessibility of the dashboard.
  - RED: axe matrix on the dashboard in light + dark and with the dock in `top`/`scrolled`/`static` has 0
    violations (`expectNoAxeViolations`); keyboard order header → engine selector → input → tabs → cards → footer;
    **no existing spec deleted or weakened** (diff review).
  - GREEN fix findings.
  - Files: `dashboard.component.spec.ts` + whichever component the finding touches. Scope S.

### Checkpoint 2 — Dashboard (end of PR 2)

- [ ] Gates of Phase 1 green; all dashboard specs green.
- [ ] Browser: dark, light and mobile match `mockup/states/dark-*`, `light-*`, `mobile-*` (owner review of the declared amendments).
- [ ] **Loop smoke:** 1, 2, 3, 4 and 10 rows at 900 px and at 390 × 844 — dock changes state ≤ 1× per scroll
      direction, `document.getAnimations()` empty after 1 s at rest (numbers recorded in `verify-report.md`).
- [ ] Lighthouse accessibility ≥ 96 on both profiles with **both baseline findings gone**: `aria-prohibited-attr`
      (task 2.10) and `label-content-name-mismatch` (task 2.8); any new finding is fixed or listed with a reason.
- [ ] Review with owner.

## Phase 3: Configurator (PR 3) — depends on Checkpoint 1 and tasks 2.1–2.2

- [ ] 3.1 **Page layout, heading panel, sticky header.** Spec: `yaml-configurator` § Configurator page
      layout, § Sticky header band.
  - RED `configurator-page.component.spec.ts`: eyebrow `DASHBOARD SETUP`, `h1` `Configuration editor`; sections
    numbered `01`–`07` in order, each `aria-labelledby` its heading; header registers with Δ ≈ 10 and follows the
    mode (`static` for a short draft — no flip-flop with stubbed metrics).
  - GREEN layout (side-nav column + 1008 px content), header dock directive.
  - Files: `configurator-page.component.{html,ts}`, spec. Scope M.
- [ ] 3.2 **Scroll-spy and side navigation.** Spec: § Numbered sections and scroll-spy navigation.
  - RED `active-section.spec.ts` (pure): last section with top ≤ threshold; threshold ≥ live stack height + 24
    (140 / 200 floor); bottom of page ⇒ last section; **property test:** for any stack height, scrolling a
    section to `scroll-margin-top` makes _that_ section active. Component spec: `aria-current="true"` on the
    active item; activating `05 Applications` scrolls and focuses its heading.
  - GREEN `active-section.ts`, side-nav markup, `scroll-margin-top` from the live stack height.
  - Files: `active-section.ts`, `active-section.spec.ts`, `configurator-page.component.{html,ts}`. Scope M.
- [ ] 3.3 **Chip bar (≤ 900 px).** Spec: § Responsive configurator (layout part). Depends 3.2.
  - RED component spec (stubbed `matchMedia`): below 900 px the nav is one non-wrapping row; wheel `deltaY`
    maps to `scrollLeft`; edge-fade state only on the overflowing side; back-button label visually hidden at
    ≤ 600 px but still the accessible name.
  - GREEN chip-bar markup/CSS + small `horizontal-nav.directive.ts` (wheel mapping, fade state).
  - Files: `horizontal-nav.directive.ts`, spec, `configurator-page.component.{html,ts}`. Scope M.
- [ ] 3.4 **Chip auto-centre.** Spec: § Responsive configurator (auto-scroll rules). Depends 3.3.
  - RED `chip-autocenter.spec.ts` (fake timers): changing the active section scrolls only the bar's
    `scrollLeft` (window `scrollY` unchanged); smooth normally, instant under reduced motion; while pointer/touch/wheel
    is active on the bar and for 1 s after, no centring; resumes on the next change; bar's own scroll events never
    trigger centring or an active-section change.
  - GREEN directive/logic (`scrollTo` on the bar element only; never `scrollIntoView`).
  - Files: `chip-autocenter.directive.ts`, spec. Scope S.
- [ ] 3.5 **Starting point cards + validation panel.** Spec: § Starting point cards, § Validation summary panel.
  - RED spec: mounted card hidden without a valid mounted YAML; selected card exposes `aria-pressed`; validation
    panel `role="alert"` lists `applications[6].category — Category 'iot' does not exist.` and the field is
    `aria-describedby` that message.
  - GREEN markup (dashed import card, tinted selected card, `--down` panel).
  - Files: `configurator-page.component.{html,ts}`, spec. Scope S–M.
- [ ] 3.6 **Switch and segmented controls.** Spec: § Switch and segmented controls; `design-system` § UI component boundaries.
  - RED `switch.component.spec.ts`: `role="switch"`, `aria-checked`, Space toggles, label is the name;
    `segmented.component.spec.ts`: radio-group semantics, arrows move selection, group label;
    configurator spec: toggling `Show seconds` makes the exported YAML contain `showSeconds: true` (data parity).
  - GREEN `app-switch`, `app-segmented` (standalone, signals, `input()`/`output()`), swap them into the settings
    section for every flag, Theme and Date position.
  - Files: `shared/components/app-switch/*`, `shared/components/app-segmented/*`, `configurator-page.component.html`, spec. Scope M.
- [ ] 3.7 **Fields and collection rows.** Spec: § Field styling, § Collection rows and inline editor (rows part).
  - RED `collection-editor.component.spec.ts`: row shows index, icon, name, secondary mono text, category tag,
    flags summary (`health · new tab` / `new tab`); move/edit/delete buttons have names containing the item name;
    reorder keeps focus on the same button; labels are the fields' accessible names.
  - GREEN markup/styles with `--field`, `--field-border`.
  - Files: `collection-editor.component.{html,ts}`, spec. Scope M.
- [ ] 3.8 **Inline editor.** Spec: § Collection rows and inline editor (editor part). Depends 3.7.
  - RED spec: edit expands the editor under the row with Name, URL, Description, Icon type, Icon value, Category,
    Tags, Open in new tab, Favorite, Health check; focus moves to the first field; collapse restores focus to the edit button.
  - GREEN tinted row + editor layout.
  - Files: `collection-editor.component.{html,ts}`, spec. Scope S–M.
- [ ] 3.9 **Export panel.** Spec: § Export panel.
  - RED spec: `Copy YAML`, `Download YAML`, `Save`; Save without token shows the labelled password field with help text
    naming `CONFIG_WRITE_TOKEN`; Cancel closes without saving; behaviour of copy/download/save unchanged.
  - GREEN markup (accent primary buttons).
  - Files: `configurator-page.component.{html,ts}`, spec. Scope S.
- [ ] 3.10 **Light theme + a11y matrix.** Spec: § Light theme, § Accessible and non-persistent workflow (modified).
  - RED: theme toggle on the configurator switches the `dark` class and persists exactly like the dashboard; navigating
    back shows the same theme; axe matrix (dark/light, invalid draft, desktop + chip-bar layouts) has 0 violations;
    no `localStorage` draft persistence (existing test kept).
  - GREEN fixes; derive any missing light values from tokens (audit stays green).
  - Files: `configurator-page.component.spec.ts` + findings. Scope S.

### Checkpoint 3 — Configurator (end of PR 3)

- [ ] Gates green; configurator specs green.
- [ ] Browser: 1440 (dark + light), 800 and 390 px — chip bar follows scroll, auto-centres, never fights a manual drag,
      clicking a chip activates that chip; compare with `mockup/states/config-*`.
- [ ] Review with owner.

## Phase 4: Verification, documentation and ship prep (PR 4)

- [ ] 4.1 **Full regression.** `ng test --watch=false` (coverage threshold on), `npm run lint`, `ng build` (budgets: initial ≤ 500 kB warning), `npm run format:check`,
      `npm run check:focused-tests`. Verify no pre-existing spec was deleted/weakened (git diff of `*.spec.ts` reviewed).
- [ ] 4.2 **Browser smoke matrix** (throwaway scripts, not committed): states of `mockup/states/*` (dark/light/mobile/config),
      scroll states, engine menu, hover, empty state; the **loop smoke** of Checkpoint 2 repeated on the final build and at 125 %/200 % zoom.
- [ ] 4.3 **Performance.** Lighthouse desktop + mobile vs the 0.5 baseline (≤ 5 points worse); scroll jank with 20 cards and blur on a
      low-end profile (CPU 4× throttle); decide on tuning blur radii if needed.
- [ ] 4.4 **Visual sign-off.** Side-by-side of every `mockup/states/*` vs the build, listing each deviation (must be only the declared
      amendments). Owner approves. Files: `verify-report.md`.
- [ ] 4.5 **Docs.** Regenerate `screenshots/dashboard.png`, `dashboard_light.png`, `configurator.png`; update README (screenshots, theming/background note),
      `ARCHITECTURE.md` (design tokens, `ScrollStateService`, shell/header ownership, new shared components). CHANGELOG entry is written in the
      release-prep commit (version chosen then; user-visible change, no config/API change ⇒ minor).
- [ ] 4.6 **`verify-report.md`.** Compare the implementation against **every** scenario in `specs/**`; table `scenario → evidence`
      (test name or smoke note); open issues empty or explicitly accepted.
- [ ] 4.7 **Ship (separate, after merge and release).** Promote `design-system` and `dashboard-ui` into `openspec/specs/`, apply the MODIFIED/ADDED
      requirements to `yaml-configurator` and `app-status-check`, add the README capability rows, move this change to
      `changes/archive/<date>-ui-redesign/`. Warn before merging destructive deltas (config rule).

### Checkpoint 4 — Complete

- [ ] Every success criterion of `proposal.md` met; `verify-report.md` complete.
- [ ] Ready for review / merge to `develop`.

---

## Risks tracked per task

| Task    | Risk                                                                     | Mitigation                                                                                                |
| ------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 1.3     | Angular build may not resolve `@fontsource*` `url()` for the two subsets | Spike first; fallback copy to `public/fonts/`                                                             |
| 1.6–1.7 | Any residual loop on short pages                                         | Fixed-point test, dead band, dwell, breaker, browser loop smoke at Checkpoint 2 and 4.2                   |
| 2.1     | Moving `app-header` out of the shell touches both views                  | Land it alone with its own spec; configurator only renders the header, no restyle                         |
| 2.11    | Dock wraps components owned by different slices                          | Dock registers via the contract of 1.7/1.8; compact variants are driven by the `data-dock` attribute only |
| 3.6     | Swapping checkboxes for switches could change exported data              | Data-parity test through the YAML export                                                                  |
| 4.3     | `backdrop-filter` cost on low-end GPUs                                   | Blur radii are tokens; opaque fallback exists (1.5)                                                       |
| 2.10    | Toast restyle changes its look and could regress dismiss focus handling  | Existing toast specs kept green; surface goes through the audited card recipe                             |
