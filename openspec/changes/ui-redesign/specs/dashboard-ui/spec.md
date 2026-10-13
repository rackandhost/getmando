# Dashboard UI Specification

## Purpose

Define the layout, components and scroll behaviour of the dashboard (`/`) in the "Consola" design, as
shown in the live prototype (`mockup/states/`). Behaviour of data, search, categories and status
polling is defined elsewhere and unchanged; this spec covers presentation and presentation-driven
behaviour. Metrics and tokens: `design.md` § 3–4.

## Requirements

### Requirement: Page structure

The dashboard MUST render, top to bottom: header, clock section, search bar, category tab bar, app
grid, footer, inside a centred container of at most 1360 px including inline padding
`clamp(16px, 4vw, 40px)`. The page (window), not an inner container, MUST scroll.

#### Scenario: Desktop structure

- GIVEN a 1440 × 900 viewport and 10 apps
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

### Requirement: Sticky dock (desktop)

On viewports wider than 600 px and at least 720 px high, the header, clock section, search bar and
tab bar MUST be wrapped in one sticky container (the dock) at `top: 0`. In the _top_ state it is
transparent. When the scroll state becomes _scrolled_ (`scrollY > 40`; back to _top_ when
`scrollY ≤ 4`) the dock MUST gain the band background, `blur(22px) saturate(160%)` and edge shadow of
`design.md` § 3.1, the header padding MUST drop from 24 px to 12 px, and the tab gap from 28 px to
12 px. The app grid scrolls beneath the dock. On viewports shorter than 720 px the dock MUST NOT be
sticky.

#### Scenario: Entering the scrolled state

- GIVEN the dashboard at scroll position 0 on a 1440 × 900 viewport
- WHEN the page scrolls to 41 px
- THEN the dock shows the band and its height drops from about 584 px to about 278 px
- AND the cards continue to scroll beneath it

#### Scenario: Hysteresis

- GIVEN the scrolled state is active
- WHEN scrollY falls to 5 px
- THEN the state remains scrolled
- AND at 4 px it returns to the top state

#### Scenario: No oscillation at the threshold

- GIVEN the page is scrolled to exactly 41 px
- WHEN the dock changes height and the document height changes accordingly
- THEN the scrolled state does not flip back and forth

#### Scenario: Short viewport

- GIVEN a 1280 × 600 viewport
- WHEN the page is scrolled
- THEN the dock scrolls away with the page and does not cover the cards

### Requirement: Clock widget

The clock MUST render `HH:mm` (24-hour, existing timer cadence) as a glass widget with the hours in
`--clock-ink`, a static `--accent` colon, and minutes drawn with the amended `--minute-fill` and a
2 px `--accent` text stroke, in Nunito 800 at `clamp(88px, 11vw, 150px)`. A weekday pill (accent
background, uppercase weekday) and a date pill (outlined) MUST follow `showDate` and `datePosition`.
When `showSeconds` is true a seconds readout MUST be displayed next to the minutes. The widget MUST
NOT be an `aria-live` region and MUST NOT blink.

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

#### Scenario: Colon never pulses

- GIVEN any motion preference
- WHEN several seconds elapse
- THEN the colon's opacity stays at 1

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
and, when a query exists, a clear button and an accent submit button. The input MUST keep the
accessible name `Search applications`, the existing key behaviour (Enter submits to the selected
engine, input filters apps), and the placeholder `Search your applications…` for the Apps scope or
`Search on <engine>…` for an engine. Height MUST be 60 px at the top state. In the scrolled desktop
state it MUST shrink to 44 px with max-width 440 px, and MUST expand to 52 px / full width while the
input is focused, the query is non-empty, or the engine menu is open.

#### Scenario: Expands on focus when scrolled

- GIVEN the scrolled state and an empty, unfocused search
- WHEN the input receives focus
- THEN the bar becomes 52 px high and full width

#### Scenario: Stays expanded with a query

- GIVEN the scrolled state and the query `plex`
- WHEN the input loses focus
- THEN the bar remains expanded

#### Scenario: Submit and clear appear with a query

- GIVEN an empty search
- WHEN the user types `media`
- THEN a clear button and an accent submit button appear
- AND activating clear empties the query and removes both buttons

### Requirement: Engine menu

The engine selector button MUST expose `aria-expanded` and open a `listbox` popover whose first option
is `Your apps` followed by the enabled search engines; the selected option MUST show a check mark and
the `--surface-2` background. Selecting an option closes the menu, sets the engine and updates the
placeholder; Escape or an outside click closes it without changing the engine.

#### Scenario: Engine selection

- GIVEN the engine menu is open
- WHEN the user selects `Startpage`
- THEN the menu closes, the button shows `Startpage`, and the placeholder reads `Search on Startpage…`

#### Scenario: Keyboard

- GIVEN the engine button has focus
- WHEN the user opens the menu with Enter or Space, moves with the arrow keys and presses Enter
- THEN the highlighted engine is selected and focus returns to the button

#### Scenario: Escape

- GIVEN the menu is open
- WHEN the user presses Escape
- THEN the menu closes and the previous engine stays selected

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

Each app MUST render as a single activator with the existing accessible name pattern and open
behaviour (`openNewTab` → new tab else same tab). The card MUST show a 44 × 44 icon tile (radius 12),
the app name (16/600), optional status pill, the description when `showDescriptions` is true, and the
tag chips when `showLabels` is true and tags exist. Cards in a row MUST stretch to equal height.
Hover and keyboard focus MUST apply the lift, border and shadow of `design.md` § 4.4.

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

### Requirement: App grid and empty state

The grid MUST use a 14 px gap and the existing responsive ladder: 1 column by default, 2 from `md`,
3 from `lg`, and `itemsPerRow` from `xl`. The empty state MUST render a card with a dashed border, a
magnifier-minus icon, the title `No applications found` and the existing helper copy; no emoji. The
loading state MUST keep its current behaviour.

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
- THEN the empty-state card is shown with the existing copy and the tabs are dimmed

### Requirement: Mobile sticky dock

At and below 600 px the header and clock MUST scroll away normally and MUST NOT collapse. The search
bar and the tab bar MUST be wrapped in a sticky dock at `top: 0` (113 px: padding-top 12, search 44,
gap 12, tabs 45), bleeding to the container edges and gaining the band, blur and shadow once the
scrolled state is active. Tab gap is 12 px. On viewports shorter than 500 px the dock MUST NOT be
sticky.

#### Scenario: Sticky search and tabs on mobile

- GIVEN a 390 × 844 viewport scrolled past 40 px
- WHEN the page is observed
- THEN the header and clock have scrolled away
- AND the search bar and tab bar are pinned at the top with the band background

#### Scenario: Clock size on mobile

- GIVEN a 390 px viewport
- WHEN the clock renders
- THEN the digits are 88 px (`clamp(88px, 11vw, 150px)`) and the widget does not collapse

#### Scenario: Landscape phone

- GIVEN a 740 × 390 viewport
- WHEN the page is scrolled
- THEN the dock scrolls with the page

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
viewports, with the dock in both states, expose `header`, `main`, `nav` (`Categories`) and `footer`
landmarks, keep a visible keyboard path through every control, and not rely on colour alone for any
state.

#### Scenario: Axe

- GIVEN the dashboard with sample data in each theme and viewport
- WHEN axe runs
- THEN there are zero violations

#### Scenario: Keyboard order

- GIVEN focus at the start of the page
- WHEN the user presses Tab repeatedly
- THEN focus visits header buttons, engine selector, input, tabs, cards, footer links in visual order

#### Scenario: Focus under the dock

- GIVEN the scrolled state
- WHEN keyboard focus reaches a card whose top edge is behind the dock
- THEN the page scrolls so the card is fully visible below the dock
