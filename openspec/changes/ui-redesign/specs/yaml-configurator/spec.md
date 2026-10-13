# YAML Configurator — Delta for UI Redesign

Presentation changes only. The behaviour requirements of `openspec/specs/yaml-configurator/spec.md`
(lazy route, source choice, import/edit, semantic validation, export, non-persistence) remain in force.
Visual reference: `mockup/states/config-*.png` (dark theme only in the mockup; the light theme is
derived from the same tokens as the dashboard — see `design.md` § 7).

## ADDED Requirements

### Requirement: Configurator page layout

The configurator MUST render a sticky header (same chip and theme button as the dashboard, with a
`Back to dashboard` button instead of the configurator link), a page heading block (eyebrow
`DASHBOARD SETUP`, `h1` `Configuration editor`, one-line description) in a glass panel, and below it
a two-column layout: a 240 px side navigation and a content column of numbered section cards. At
1440 px the content column is 1008 px wide with 28 px card padding. The page (window) scrolls.

#### Scenario: Desktop layout

- GIVEN a 1440 px viewport
- WHEN `/configure` renders
- THEN the side navigation is 240 px wide, sticky at `top: 104px`, beside the content column

### Requirement: Sticky header band

The header MUST be sticky at `top: 0`. In the top state it is transparent with 24 px vertical
padding; once the scroll state is _scrolled_ (`scrollY > 40`, back to top at `scrollY ≤ 4`) it MUST
gain the band background, blur and shadow of `design.md` § 3.1 and reduce its padding to 14 px.

#### Scenario: Short draft stays static

- GIVEN a draft whose page is barely taller than the viewport
- WHEN the user scrolls
- THEN the header never flips between states and no padding transition loops

#### Scenario: Header band appears

- GIVEN the configurator at scroll position 0
- WHEN the page scrolls to 41 px
- THEN the header shows the band and its padding is 14 px
- AND content scrolls beneath it

### Requirement: Numbered sections and scroll-spy navigation

The content MUST be divided into sections numbered `01`–`07`: Starting point, Metadata, Settings,
Categories, Applications, Bookmarks, Export. The side navigation MUST list them in order with their
numbers, mark the active section with `aria-current="true"`, a 2 px accent left line and a tinted
background, and scroll to a section when its item is activated. The active section MUST be the last
section whose top edge is at or above 140 px from the viewport top (200 px at ≤ 900 px wide), and the
last section when the page is scrolled to the bottom. Each section MUST be a labelled region
(`aria-labelledby` its heading).

#### Scenario: Navigate to a section

- GIVEN the side navigation
- WHEN the user activates `05 Applications`
- THEN the Applications section scrolls into view below the sticky header
- AND its heading receives focus

#### Scenario: Current section indicated

- GIVEN the user scrolls until the Settings section's top passes 140 px
- WHEN the scroll settles
- THEN `03 Settings` is the active item

#### Scenario: Bottom of the page

- GIVEN the page is scrolled to the bottom
- WHEN the active item is evaluated
- THEN `07 Export` is active even if the Export section's top is below 140 px

### Requirement: Starting point cards

The Starting-point section MUST present three option cards — Start empty, Load mounted YAML (only when
a mounted YAML is valid and not a runtime fallback; its caption is the mounted path), Import local
YAML (dashed border) — with the selected option visibly highlighted (accent border, tinted background)
and exposed with `aria-pressed` or equivalent radio semantics.

#### Scenario: Mounted option hidden

- GIVEN no valid mounted YAML
- WHEN the section renders
- THEN no `Load mounted YAML` card is shown
- AND Start empty and Import local YAML remain

#### Scenario: Selected option

- GIVEN the user chooses Load mounted YAML
- WHEN the section renders
- THEN that card shows the accent border and the selected state is exposed to assistive technology

### Requirement: Validation summary panel

Validation errors MUST be listed in a panel headed `Fix the following errors`, using `--down` text,
border and tint, one item per error with its field path in IBM Plex Mono, announced to assistive
technology (`role="alert"` or equivalent) when it appears. Each error MUST remain programmatically
associated with its field.

#### Scenario: Errors displayed

- GIVEN a draft with `applications[6].category` referencing a missing category
- WHEN validation runs
- THEN the panel lists `applications[6].category — Category 'iot' does not exist.`
- AND the offending field is described by that message

### Requirement: Switch and segmented controls

Boolean settings and flags (show seconds, show date, allow bookmarks, show "Apps" category, show
descriptions, show labels, each search engine, per-app open-in-new-tab, favorite, health check) MUST
be presented as switches inside labelled tiles: 44 × 26 px track, `role="switch"`, `aria-checked`,
visible text label, on state `--accent`. **Theme** (`Light | Dark | Auto`) and **Date position**
(`Top | Bottom`) MUST be segmented controls with radio-group semantics and a group label. Toggling or
choosing MUST change the same draft fields as the former controls.

#### Scenario: Toggle with keyboard

- GIVEN focus on `Show seconds`
- WHEN the user presses Space
- THEN the setting toggles and `aria-checked` reflects the new value

#### Scenario: Segmented control with arrows

- GIVEN focus on the Theme control with `Dark` selected
- WHEN the user presses the right arrow
- THEN `Auto` is selected and the draft's theme is `auto`

#### Scenario: Same data

- GIVEN the user enables `Show seconds`
- WHEN the draft is exported
- THEN the YAML contains `showSeconds: true` as before

### Requirement: Field styling

Text inputs, selects and textareas MUST be 44 px high (textarea min 44), radius 10, field background
token, a 1 px `--field-border` (≥ 3 : 1 against the card and the field fill), with the two-tone focus ring and a persistent `label` above (13/500).
Monospace is used for paths, URLs, format strings and YAML-like values (IBM Plex Mono).

#### Scenario: Labelled field

- GIVEN any field in the configurator
- WHEN a screen reader reads it
- THEN its visible label is its accessible name

### Requirement: Collection rows and inline editor

Categories, Applications and Bookmarks MUST render as ordered rows showing index, icon (applications
and bookmarks), name, secondary text (id or URL, monospace), a category tag, a flags summary
(`health · new tab`, `new tab`), and move up, move down, edit and delete icon buttons with accessible
names containing the item name (44 px hit area on touch viewports). Edit MUST expand an inline editor
panel directly beneath the row (accent-tinted background and ring) containing that item's fields;
the behaviour of the existing `collection-editor` (add, remove, reorder, focus management) is
retained.

#### Scenario: Edit in place

- GIVEN the Applications list
- WHEN the user activates edit on `Mosquitto`
- THEN an inline editor with Name, URL, Description, Icon type, Icon value, Category, Tags, Open in new tab, Favorite, Health check appears under that row
- AND focus moves to the first field

#### Scenario: Reorder announces result

- GIVEN the row `Media`
- WHEN the user activates `Move up`
- THEN the row moves above its predecessor and focus stays on the same button

#### Scenario: Flags summary

- GIVEN an app with `openNewTab: true` and `healthCheck: true`
- WHEN its row renders
- THEN the flags text reads `health · new tab`

### Requirement: Export panel

The Export section MUST present `Copy YAML`, `Download YAML` and `Save` actions. When saving needs a
write token, an inline panel MUST appear with a password-type `Write token` field, help text naming
`CONFIG_WRITE_TOKEN`, and `Save token & save` / `Cancel`. Primary actions use `--accent` background
with `--accent-ink` text.

#### Scenario: Token needed

- GIVEN no stored write token
- WHEN the user chooses Save
- THEN the token panel appears with a labelled password field and the help text
- AND `Cancel` closes it without saving

### Requirement: Responsive configurator

At ≤ 900 px the layout MUST become one column and the side navigation MUST become a horizontal chip
bar, full width and sticky at `top: 96px`: items in a single row without wrapping, native horizontal
scroll without a visible scrollbar, vertical wheel input mapped to horizontal scroll, edge fades
shown only on the side that overflows, and the active item smooth-scrolled to the centre. At ≤ 600 px
the `Back to dashboard` label MUST be visually hidden (the icon stays and the accessible name is
preserved).

#### Scenario: Tablet

- GIVEN a 800 px viewport
- WHEN `/configure` renders
- THEN the side navigation is a single horizontal row above the content and scrolls sideways

#### Scenario: Active chip follows the scroll

- GIVEN the chip bar overflows horizontally
- WHEN the active section changes to `06 Bookmarks`
- THEN that chip is scrolled to the centre of the bar

#### Scenario: Phone

- GIVEN a 390 px viewport
- WHEN the header renders
- THEN the back button shows only its icon and its accessible name remains `Back to dashboard`

### Requirement: Light theme

The configurator MUST render in both light and dark themes using the tokens of `design-system`; the
header theme button MUST toggle the theme as on the dashboard.

#### Scenario: Theme toggle on the configurator

- GIVEN the configurator in dark theme
- WHEN the user activates `Toggle theme`
- THEN the whole configurator switches to the light tokens and all contrast requirements still hold
- AND the choice is stored and applied exactly as the dashboard's theme toggle does

#### Scenario: Theme is shared with the dashboard

- GIVEN the user switches to light on the configurator
- WHEN they follow `Back to dashboard`
- THEN the dashboard is displayed in the light theme

## MODIFIED Requirements

### Requirement: Accessible and non-persistent workflow

The configurator MUST meet WCAG AA and AXE checks **in light and dark themes at desktop and phone
viewports**, provide keyboard-operable collection editing, stable focus, and associated labels/errors,
and MUST NOT let the sticky header or side navigation obscure a focused control. It MUST NOT autosave
drafts, use local storage, or write generated configuration to a server.

(Previously: WCAG AA and AXE checks, keyboard-operable collection editing, stable focus and associated
labels/errors, no persistence — unchanged except for the explicit theme/viewport matrix and the
focus-not-obscured clause.)

#### Scenario: Keyboard and validation accessibility

- GIVEN a user edits nested collections using a keyboard
- WHEN an item is added, removed, focused, or invalid
- THEN controls remain operable and focus is intentionally managed
- AND labels and validation errors are programmatically associated

#### Scenario: Focus not obscured

- GIVEN the page is scrolled with the sticky header shown
- WHEN a field just below the header receives focus
- THEN it is fully visible beneath the header

#### Scenario: Axe matrix

- GIVEN the configurator with an invalid draft
- WHEN axe runs in dark and light at 1440 px and 390 px
- THEN there are zero violations

#### Scenario: Session ends without persistence

- GIVEN a user has an incomplete or complete draft
- WHEN the configurator is reloaded
- THEN no draft is restored from browser storage
- AND the dashboard or server configuration remains unchanged
