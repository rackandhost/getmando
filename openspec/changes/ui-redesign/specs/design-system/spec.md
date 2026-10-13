# Design System Specification

## Purpose

Provide the shared visual foundation of the "Consola" redesign — theme tokens, typography, glass
surfaces with legibility floors, background scrim, focus and motion rules, and contrast guarantees —
so that every screen renders consistently and accessibly in light and dark themes over any user
background image. Values are defined in `design.md` § 3; this spec states what MUST hold.

## Requirements

### Requirement: Theme tokens

The application MUST define its colour, glass, radius and shadow values as CSS custom properties,
with a light set on `:root` and a dark set applied under the existing `.dark` class. Components MUST
consume the tokens and MUST NOT hard-code theme colours. The values MUST equal those in
`design.md` § 3.1–3.2, including the accessibility amendments.

#### Scenario: Dark theme

- GIVEN the `dark` class is present on the root element
- WHEN any token is resolved
- THEN `--bg` is `#0D0F11`, `--text` is `#EDEBE6`, `--accent` is `#F0B04A`, and `--minute-fill` is `rgba(240,176,74,0.65)`

#### Scenario: Light theme

- GIVEN the `dark` class is absent
- WHEN any token is resolved
- THEN `--bg` is `#F3F1EC`, `--text` is `#16181B`, `--accent` is `#9A5B00`, and `--minute-fill` is `rgba(154,91,0,0.75)`

#### Scenario: Theme switch is immediate

- GIVEN the dashboard is displayed
- WHEN the user toggles the theme
- THEN all surfaces, text and accents change in the same frame without a page reload
- AND the stored theme preference semantics (`light | dark | auto`) are unchanged

### Requirement: Typography and self-hosted fonts

The application MUST render UI text in Nunito and data text (dates, tags, status, footer, step
indices, eyebrow labels, paths and URLs in the configurator) in IBM Plex Mono, using the sizes and
weights in `design.md` § 3.3. The font files MUST be bundled with the application (Latin and
Latin-Extended subsets, `woff2`) and served from its own origin; no request to a third-party font host MAY be made. While a
font is loading, text MUST remain visible using the system fallback (`font-display: swap`).

#### Scenario: Fonts are self-hosted

- GIVEN the application is loaded
- WHEN the network requests are inspected
- THEN no request is made to a third-party font host
- AND Nunito and IBM Plex Mono resolve from the application origin

#### Scenario: Offline first paint

- GIVEN the font files are not yet loaded
- WHEN the page renders
- THEN text is visible in the fallback stack and swaps when the fonts arrive

### Requirement: Glass surfaces with a legibility floor

Header chip, buttons, clock widget, search bar, tab bar, cards, footer and configurator panels MUST
use the surface recipes of `design.md` § 3.2 (gradient/colour, 1 px line, inset highlights, blur)
**on top of an opaque floor layer** coloured `--surface` whose opacity is `--floor-bar`,
`--floor-card` or `--floor-clock` (dark 0.15 / 0.35 / 0.15, light 0.55 / 0.80 / 0.90). Where
`backdrop-filter` is not supported, surfaces MUST fall back to an opaque colour from the same token
family so text remains legible.

#### Scenario: Blur supported

- GIVEN a browser that supports `backdrop-filter`
- WHEN a card is rendered over a background image
- THEN the card applies `blur(16px) saturate(150%)` (dark) / `saturate(160%)` (light) over its floor layer

#### Scenario: Blur unsupported

- GIVEN a browser without `backdrop-filter`
- WHEN a card is rendered
- THEN it uses an opaque background token and no content loses contrast

#### Scenario: Dark photo under the light theme

- GIVEN the light theme and a configured light-theme background image that is nearly black
- WHEN the clock widget and a card render
- THEN their text still meets the contrast thresholds of this specification

### Requirement: Background and scrim

The page MUST keep rendering the configured `lightBackgroundImage` / `darkBackgroundImage` full-bleed
(`cover`, centred), covered by a scrim whose colour and opacity are `rgba(13,15,17,0.6)` in dark and
`rgba(243,241,236,0.2)` in light. When the configured image is empty or fails to load, the page
background MUST be `--bg`. The scrim opacities MUST NOT be user-configurable in this change.

#### Scenario: Image configured

- GIVEN `darkBackgroundImage` is set and the dark theme is active
- WHEN the page renders
- THEN the image is visible beneath a 0.6 dark scrim

#### Scenario: No image

- GIVEN the background image setting is empty
- WHEN the page renders in light theme
- THEN the page shows `#F3F1EC` under the 0.2 scrim

### Requirement: Contrast guarantees

Every text/background and UI-boundary pair listed in `design.md` § 5 MUST meet its required ratio
(4.5 : 1 for text, 3 : 1 for large text and UI boundaries) in both themes against the **worst-case
backdrop**: the pair is evaluated over pure black and pure white under the scrim, through the real
surface stack (floor layer and glass gradient at its top and bottom stops), and the lower ratio is
used. The clock minute digits MUST meet 3 : 1 by their fill alone (amended `--minute-fill`), in
addition to carrying the 2 px accent stroke; the stroke width MUST NOT be below 1 px at any size.

#### Scenario: Token pairs verified

- GIVEN the token stylesheet
- WHEN the token-contrast test composites each listed pair over black and over white backdrops
- THEN every pair meets or exceeds its required ratio in light and dark

#### Scenario: Minute digits legible without the stroke

- GIVEN the clock widget in either theme
- WHEN the contrast of the minute fill against the widget is computed at the worst-case backdrop
- THEN it is at least 3 : 1

#### Scenario: Muted text is readable

- GIVEN a card description rendered with `--muted`
- WHEN its contrast against the card is measured at the worst-case backdrop
- THEN it is at least 4.5 : 1 in both themes

#### Scenario: A token regression is caught

- GIVEN a change that lowers `--floor-card` in the light theme below the AA threshold
- WHEN the token-contrast test runs
- THEN it fails and names the pair and theme

### Requirement: Focus indicator

Every interactive element MUST show a two-tone focus ring in both themes: `outline: 2px solid
var(--focus)`, offset 2 px, plus a 2 px `--focus-halo` ring. The ring MUST NOT be clipped by its
container and MUST NOT be hidden under a sticky bar.

#### Scenario: Keyboard focus

- GIVEN a user tabs through the page
- WHEN any control receives focus
- THEN the ring is visible against the adjacent surface at ≥ 3 : 1 in both themes

#### Scenario: Focus under a sticky bar

- GIVEN the page is scrolled and a sticky dock or header band is shown
- WHEN a control scrolled just beneath the band receives focus
- THEN the page scrolls so the control is fully visible below the band (scroll padding equals the band's live height)

### Requirement: Motion

The clock colon MUST NOT blink or pulse. When `prefers-reduced-motion: reduce` is set, the
application MUST disable all transform, size, opacity and padding transitions defined by this
redesign; state changes MUST apply instantly.

#### Scenario: Static colon

- GIVEN the dashboard is displayed for ten seconds
- WHEN the clock colon is observed
- THEN its opacity is constant at 1

#### Scenario: Reduced motion on

- GIVEN the operating system requests reduced motion
- WHEN the page is scrolled past the compact threshold or a card is hovered
- THEN the layout changes without animated transitions

### Requirement: Scroll-state stability

The sticky chrome (dashboard dock, mobile search/tabs dock, configurator header) MUST be driven by
one shared scroll state with three values — _Static_, _Top_, _Scrolled_ — and MUST be free of
feedback loops: no sequence of scroll positions, content heights or viewport sizes MAY cause the
chrome to change state repeatedly without user input.

1. The change _Top → Scrolled_ occurs at `scrollY > 40` and _Scrolled → Top_ at `scrollY ≤ 4`.
2. Compaction is allowed (_eligible_) only if the page still scrolls after the chrome compacts:
   `R = (docTop − viewportHeight) − Δ ≥ 80`, where `docTop` is the document height in the _Top_
   layout and `Δ` the height the chrome loses when compacting. Once eligible it stays so until
   `R < 56`. When not eligible the chrome is _Static_ (not sticky, no band, no compaction).
3. The viewport guards (desktop dock ≥ 720 px high, mobile dock ≥ 500 px high) also force _Static_.
4. After any state change further changes are ignored until its transition has finished (≥ 400 ms; none
   under reduced motion).
5. More than 4 state changes within 2 seconds MUST latch _Static_ until the viewport size or the
   content height changes.
6. The root MUST use `scrollbar-gutter: stable` and the page container `overflow-anchor: none`.
7. Eligibility and state MUST NOT be changed from inside a `ResizeObserver` callback in the same
   frame; observers only record measurements and schedule a re-evaluation.

#### Scenario: Few apps never compact

- GIVEN a 1440 × 900 viewport and apps filling only 2 rows
- WHEN the user scrolls up and down repeatedly
- THEN the dock never enters the _Scrolled_ state and no transition runs

#### Scenario: Enough apps compact exactly once

- GIVEN a 1440 × 900 viewport and apps filling 4 or more rows
- WHEN the user scrolls past 40 px and holds the position
- THEN the dock changes to _Scrolled_ once and stays there with no further state change

#### Scenario: No clamp-induced flip-back

- GIVEN the dock has just compacted and the document is Δ px shorter
- WHEN the browser re-clamps `scrollY` to the new document height
- THEN `scrollY` is still above 4 px and the state does not return to _Top_

#### Scenario: Content shrinks while scrolled

- GIVEN the _Scrolled_ state with 6 rows
- WHEN the user types a search that leaves one row
- THEN the dock moves to _Static_ in a single step and stays there

#### Scenario: Fixed point for any input

- GIVEN any combination of document height, viewport height, Δ and scroll intent within the tested ranges
- WHEN the closed-loop test iterates the system with the input held constant
- THEN the state reaches a fixed point within 2 iterations

#### Scenario: Circuit breaker

- GIVEN an unforeseen cause makes the state change 5 times within 2 seconds
- WHEN the fifth change is requested
- THEN the chrome latches _Static_ and remains there until the viewport size or content height changes
- AND the event is logged once through `LoggerService` without a user notification

#### Scenario: Scrollbar appears or disappears

- GIVEN content that crosses the viewport height as the window is resized
- WHEN the vertical scrollbar would appear or disappear
- THEN the layout width does not change and no `vw`-based size changes because of it

### Requirement: UI component boundaries

The boundary of every text field, select and textarea, and the knob/track and selected state of switches
and segmented controls MUST meet 3 : 1 against the adjacent colours (WCAG 1.4.11). `--field-border` is
`rgba(255,255,255,0.45)` in dark and `rgba(22,24,27,0.55)` in light; a selected segment MUST combine
`--surface-2`, a `--field-border` outline and `--text` colour.

#### Scenario: Field border contrast

- GIVEN a configurator text field in each theme
- WHEN the border contrast against its card and against the field fill is computed at the worst-case backdrop
- THEN it is at least 3 : 1

#### Scenario: Selected segment is identifiable without colour alone

- GIVEN the Theme segmented control with `Dark` selected
- WHEN it is rendered in either theme
- THEN the selected segment has an outline and fill distinct from the others and `aria-checked="true"`

### Requirement: No behavioural change

The redesign MUST NOT alter the configuration schema, settings semantics, routes, services' public
APIs, or the YAML/API contracts. Existing behavioural specs remain valid except where a delta in this
change says otherwise.

#### Scenario: Existing configuration renders

- GIVEN a `dashboard.yaml` valid before this change
- WHEN the redesigned dashboard loads it
- THEN it parses without modification and every setting (`itemsPerRow`, `showSeconds`, `showDate`, `dateFormat`, `datePosition`, `showDescriptions`, `showLabels`, `theme`, search engines, bookmarks) has its previous effect
