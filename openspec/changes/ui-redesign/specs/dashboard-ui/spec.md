# Dashboard UI Specification

## Purpose

Define the layout, components and scroll behaviour of the dashboard (`/`) in the "Consola" design.
Behaviour of data, search, categories and status polling is defined elsewhere and unchanged; this
spec covers presentation and presentation-driven behaviour. Metrics and tokens: `design.md` § 3–4.

## Requirements

### Requirement: Page structure

The dashboard MUST render, top to bottom: header, clock section, search bar, category tab bar, app
grid, footer, inside a centred container of at most 1360 px including inline padding
`clamp(16px, 4vw, 40px)`. The page, not an inner container, MUST scroll.

#### Scenario: Desktop structure

- GIVEN a 1440 × 1000 viewport and 10 apps
- WHEN the dashboard renders
- THEN the content column is 1280 px wide, centred
- AND the order of regions is header, clock, search, tabs, grid, footer

#### Scenario: Whole-page scroll

- GIVEN more content than fits the viewport
- WHEN the user scrolls
- THEN `window` scrolls and the footer sits after the grid in normal flow

### Requirement: Header

The header MUST show a chip with the logo, the dashboard title (fallback `Dashboard`) and description
(fallback `Your selfhosted applications`), and two 44 × 44 icon buttons: configurator link
(`Open configurator` on `/`, `Back to dashboard` on `/configure`) and theme toggle (`Toggle theme`).
Both buttons MUST keep their accessible names and routes.

#### Scenario: Metadata from YAML

- GIVEN metadata `title: My dashboard`, `description: Simply and lovelly`
- WHEN the header renders
- THEN the chip shows both strings

#### Scenario: Icon buttons are named

- GIVEN the header icon buttons
- WHEN a screen reader reads them
- THEN they expose `Open configurator` and `Toggle theme`
- AND the icons are `aria-hidden`

### Requirement: Sticky header band (desktop)

On viewports wider than the mobile breakpoint, the header MUST be sticky at `top: 0`. When the scroll
state becomes _scrolled_ (`scrollY > 40`; returns to _top_ when `scrollY ≤ 4`) the header MUST gain
the band background, `blur(22px) saturate(160%)` and edge shadow of `design.md` § 3.1, and reduce its
vertical padding from 24 px to 12 px.

#### Scenario: Entering the scrolled state

- GIVEN the dashboard at scroll position 0
- WHEN the page scrolls to 41 px
- THEN the header shows the band and its padding is 12 px

#### Scenario: Hysteresis

- GIVEN the scrolled state is active
- WHEN scrollY falls to 5 px
- THEN the state remains scrolled
- AND at 4 px it returns to the top state

### Requirement: Clock widget

The clock MUST render `HH:mm` (24-hour, existing timer cadence) as a glass widget with the hours in
`--clock-ink`, a `--accent` colon, and minutes drawn with `--minute-fill` and a 2 px `--accent`
text stroke, in Nunito 800 at `clamp(88px, 11vw, 150px)`. A weekday pill (accent background, uppercase
weekday) and a date pill (outlined) MUST follow `showDate` and `datePosition`. When `showSeconds` is
true a seconds readout MUST be displayed next to the minutes. The widget MUST NOT be an `aria-live`
region.

#### Scenario: Default rendering

- GIVEN the time is 18:43 on Tuesday 13 October 2026, `showDate: true`, `datePosition: bottom`, `showSeconds: false`
- WHEN the clock renders
- THEN the digits read `18`, `:`, `43`
- AND a `TUESDAY` pill and a date pill appear below the digits

#### Scenario: Date above

- GIVEN `datePosition: top`
- WHEN the clock renders
- THEN the pills appear above the digits

#### Scenario: Date hidden

- GIVEN `showDate: false`
- WHEN the clock renders
- THEN no pill is shown

#### Scenario: Seconds shown

- GIVEN `showSeconds: true`
- WHEN the clock renders
- THEN a two-digit seconds value updates every second beside the minutes
- AND assistive technology is not notified on each update

#### Scenario: Colon pulse respects motion preference

- GIVEN `prefers-reduced-motion: no-preference`
- WHEN each second elapses
- THEN the colon alternates between opacity 1 and 0.3 (unless Q5 resolves to static)
- AND under `prefers-reduced-motion: reduce` it stays at opacity 1

### Requirement: Compact clock when scrolled (desktop)

In the scrolled state on desktop the clock widget MUST collapse to a single row: digits 40 px (hour
stroke 1 px, minute stroke 1.2 px), date pills beside the digits separated by a 1 px divider, widget
padding `10px 22px`. Returning to the top state MUST restore the large layout.

#### Scenario: Collapse and restore

- GIVEN the top state with a 150 px clock
- WHEN the scrolled state activates
- THEN the clock becomes a 40 px single row
- AND on returning to the top state the 150 px column layout is restored

### Requirement: Search bar

The search bar MUST be a single glass control containing the engine selector button, the search input
and, when a query exists, clear and submit buttons. The input MUST keep the accessible name
`Search applications`, the existing key behaviour (Enter submits to the selected engine, input filters
apps), and the placeholder `Search your applications…` for the Apps scope or `Search on <engine>…`
for an engine. Height MUST be 60 px at the top state. In the scrolled desktop state it MUST shrink to
44 px with max-width 440 px, and MUST expand to 52 px / full width while the input is focused, the
query is non-empty, or the engine menu is open.

#### Scenario: Expands on focus when scrolled

- GIVEN the scrolled state and an empty, unfocused search
- WHEN the input receives focus
- THEN the bar becomes 52 px high and full width

#### Scenario: Stays expanded with a query

- GIVEN the scrolled state and the query `plex`
- WHEN the input loses focus
- THEN the bar remains expanded

#### Scenario: Engine selection

- GIVEN the engine menu is open
- WHEN the user selects an engine
- THEN the menu closes, the button shows the engine name, and the placeholder reads `Search on <engine>…`

### Requirement: Category tabs

The category bar MUST span the container width and show each category as a text tab; the selected
tab MUST use `--text` with a 2 px `--accent` underline and `aria-pressed="true"`. While a search query
is active, the bar MUST be dimmed to opacity 0.45, all tabs disabled and none selected. Overflow MUST
scroll horizontally without wrapping.

#### Scenario: Selection

- GIVEN tabs Apps, Bookmarks, Media
- WHEN the user selects Media
- THEN Media is underlined and `aria-pressed`, Apps is not

#### Scenario: Active search

- GIVEN the query `jelly`
- WHEN the tab bar renders
- THEN the tabs are disabled and dimmed and none shows the underline

#### Scenario: Narrow viewport overflow

- GIVEN a 390 px viewport and six categories
- WHEN the tab bar renders
- THEN it scrolls horizontally and no tab wraps onto a second line

### Requirement: App card

Each app MUST render as a single `button` activator with the existing accessible name pattern and
open behaviour (`openNewTab` → new tab else same tab). The card MUST show a 44 × 44 icon tile
(radius 12), the app name (16/600), optional status pill, the description when `showDescriptions` is
true, and the tag chips when `showLabels` is true and tags exist. Cards in a row MUST stretch to equal
height. Hover and keyboard focus MUST apply the lift, border and shadow of `design.md` § 4.4.

#### Scenario: Full card

- GIVEN an app with name, description and tags and both flags true
- WHEN the card renders
- THEN icon tile, name, description and tag chips appear in that order

#### Scenario: Description hidden

- GIVEN `showDescriptions: false`
- WHEN the card renders
- THEN no description is shown and the card height follows its content

#### Scenario: Open in new tab

- GIVEN an app with `openNewTab: true`
- WHEN the card is activated
- THEN its URL opens in a new tab

#### Scenario: Hover state

- GIVEN `prefers-reduced-motion: no-preference`
- WHEN the pointer enters a card
- THEN it translates up 4 px, the icon scales to 1.08 and the hover tokens apply

#### Scenario: Initials icon

- GIVEN an app whose icon type is `initials`
- WHEN the card renders
- THEN the generated initials image fills the icon tile and the image has an `alt`

### Requirement: App grid

The grid MUST use a 14 px gap and the existing responsive ladder: 1 column by default, 2 from `md`,
3 from `lg`, and `itemsPerRow` from `xl`. The empty state MUST render a glass card with the existing
copy and no decorative emoji; the loading state MUST keep its current behaviour.

#### Scenario: Desktop columns

- GIVEN `itemsPerRow: 5` and a 1440 px viewport
- WHEN the grid renders
- THEN there are 5 columns of 244.8 px with 14 px gaps

#### Scenario: Mobile column

- GIVEN a 390 px viewport
- WHEN the grid renders
- THEN there is one column spanning the content width (358 px)

#### Scenario: No results

- GIVEN a query that matches no app
- WHEN the grid area renders
- THEN the empty-state card is shown with the existing copy

### Requirement: Mobile compact layout

At and below the mobile breakpoint (≤ 600 px) the header MUST NOT be sticky, the clock MUST NOT
collapse on scroll, and the **search bar** MUST be sticky with the band treatment, bleeding to the
container edges with padding `12px clamp(16px, 4vw, 40px) 0`. Tab gap MUST be 12 px.

#### Scenario: Sticky search on mobile

- GIVEN a 390 × 844 viewport scrolled past 40 px
- WHEN the page is observed
- THEN the header has scrolled away and the search bar is pinned at the top with the band background

#### Scenario: Clock size on mobile

- GIVEN a 390 px viewport
- WHEN the clock renders
- THEN the digits are `clamp(88px, 11vw, 150px)` = 88 px and the widget does not collapse

### Requirement: Footer

The footer MUST be a glass bar after the grid containing, left, `Powered by Mando v<version>` (Mando
links to `https://getmando.rackandhost.com`) and, right, `Created with ♡ by Rack&Host <year>` (links
to `https://rackandhost.com`), in IBM Plex Mono 12 px. On narrow viewports the two items MAY stack. The
heart glyph MUST have an accessible name (`love`).

#### Scenario: Version shown

- GIVEN the application version is 2.1.0
- WHEN the footer renders
- THEN it reads `Powered by Mando v2.1.0`

### Requirement: Accessibility of the dashboard

The dashboard MUST pass axe with no violations in light and dark themes at desktop and mobile
viewports, expose `header`, `main`, `nav` (`Categories`) and `footer` landmarks, keep a visible
keyboard path through every control, and not rely on colour alone for any state.

#### Scenario: Axe

- GIVEN the dashboard with sample data in each theme and viewport
- WHEN axe runs
- THEN there are zero violations

#### Scenario: Keyboard order

- GIVEN focus at the start of the page
- WHEN the user presses Tab repeatedly
- THEN focus visits header buttons, engine selector, input, tabs, cards, footer links in visual order
