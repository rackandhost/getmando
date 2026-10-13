# Design System Specification

## Purpose

Provide the shared visual foundation of the "Consola" redesign — theme tokens, typography, glass
surfaces, background scrim, focus and motion rules, and contrast guarantees — so that every screen
renders consistently in light and dark themes. Values are defined in `design.md` § 3; this spec states
what MUST hold.

## Requirements

### Requirement: Theme tokens

The application MUST define its colour, glass, radius and shadow values as CSS custom properties,
with a light set on `:root` and a dark set applied under the existing `.dark` class. Components MUST
consume the tokens and MUST NOT hard-code theme colours. The values MUST equal those in
`design.md` § 3.1–3.2.

#### Scenario: Dark theme

- GIVEN the `dark` class is present on the root element
- WHEN any token is resolved
- THEN `--bg` is `#0D0F11`, `--text` is `#EDEBE6`, and `--accent` is `#F0B04A`

#### Scenario: Light theme

- GIVEN the `dark` class is absent
- WHEN any token is resolved
- THEN `--bg` is `#F3F1EC`, `--text` is `#16181B`, and `--accent` is `#9A5B00`

#### Scenario: Theme switch is immediate

- GIVEN the dashboard is displayed
- WHEN the user toggles the theme
- THEN all surfaces, text and accents change in the same frame without a page reload
- AND the stored theme preference semantics (`light | dark | auto`) are unchanged

### Requirement: Typography

The application MUST render UI text in Nunito and data text (dates, tags, status, footer, step
indices, eyebrow labels) in IBM Plex Mono, using the sizes and weights in `design.md` § 3.3. Fonts
MUST be served from the application's own origin (decision D3). While a font is loading, text MUST
remain visible using the system fallback (`font-display: swap`).

#### Scenario: Fonts are self-hosted

- GIVEN the application is loaded
- WHEN the network requests are inspected
- THEN no request is made to a third-party font host
- AND Nunito and IBM Plex Mono resolve from the application origin

#### Scenario: Offline first paint

- GIVEN the font files are not yet loaded
- WHEN the page renders
- THEN text is visible in the fallback stack and swaps when the fonts arrive

### Requirement: Glass surfaces

Header chip, buttons, clock widget, search bar, tab bar, cards, footer and configurator panels MUST
use the surface recipes of `design.md` § 3.2 (gradient/colour, 1 px line, inset highlights, blur).
Where `backdrop-filter` is not supported, surfaces MUST fall back to an opaque colour from the same
token family so text remains legible.

#### Scenario: Blur supported

- GIVEN a browser that supports `backdrop-filter`
- WHEN a card is rendered over a background image
- THEN the card applies `blur(16px) saturate(150%)` (dark) / `saturate(160%)` (light)

#### Scenario: Blur unsupported

- GIVEN a browser without `backdrop-filter`
- WHEN a card is rendered
- THEN it uses an opaque background token and no content loses contrast

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

Every text/background pair listed in `design.md` § 5 MUST meet its stated ratio (4.5:1 for body and
small text, 3:1 for large text and UI boundaries) in both themes. The 2 px accent stroke of the clock
minutes MUST meet 3:1 against the clock widget in both themes; its width MUST NOT be below 1 px at any
size.

#### Scenario: Token pairs verified

- GIVEN the token stylesheet
- WHEN the token-contrast test composites each listed pair over its backdrop
- THEN every pair meets or exceeds its required ratio in light and dark

#### Scenario: Muted text is readable

- GIVEN a card description rendered with `--muted`
- WHEN its contrast against the card is measured
- THEN it is at least 4.5:1 in both themes

### Requirement: Focus indicator

Every interactive element MUST show a visible focus ring of at least 2 px using `--accent`, offset
2 px, in both themes. The ring MUST NOT be clipped by its container and MUST NOT be hidden under a
sticky bar.

#### Scenario: Keyboard focus

- GIVEN a user tabs through the page
- WHEN any control receives focus
- THEN a 2 px accent ring is visible against the adjacent surface (≥ 3:1)

#### Scenario: Focus under a sticky bar

- GIVEN the page is scrolled and a sticky header or search band is shown
- WHEN a control scrolled just beneath the band receives focus
- THEN the page scrolls so the control is fully visible below the band (scroll padding equals the band's live height)

### Requirement: Reduced motion

When `prefers-reduced-motion: reduce` is set, the application MUST disable the colon pulse and all
transform, size and opacity transitions defined by this redesign; state changes MUST apply instantly.

#### Scenario: Reduced motion on

- GIVEN the operating system requests reduced motion
- WHEN the page is scrolled past the compact threshold or a card is hovered
- THEN the layout changes without animated transitions
- AND the clock colon does not pulse

### Requirement: No behavioural change

The redesign MUST NOT alter the configuration schema, settings semantics, routes, services' public
APIs, or the YAML/API contracts. Existing behavioural specs remain valid except where a delta in this
change says otherwise.

#### Scenario: Existing configuration renders

- GIVEN a `dashboard.yaml` valid before this change
- WHEN the redesigned dashboard loads it
- THEN it parses without modification and every setting (`itemsPerRow`, `showSeconds`, `showDate`, `dateFormat`, `datePosition`, `showDescriptions`, `showLabels`, `theme`, search engines, bookmarks) has its previous effect
