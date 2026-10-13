# YAML Configurator — Delta for UI Redesign

Presentation changes only. The behaviour requirements of `openspec/specs/yaml-configurator/spec.md`
(lazy route, source choice, import/edit, semantic validation, export, non-persistence) remain in force.

## ADDED Requirements

### Requirement: Configurator page layout

The configurator MUST render a sticky header (same as the dashboard header, with `Back to dashboard`),
a page heading block (eyebrow `DASHBOARD SETUP`, `h1` `Configuration editor`, one-line description) in a
glass panel, and below it a two-column layout: a 240 px side navigation and a content column of
numbered section cards. At 1440 px the content column is 1008 px wide with 28 px card padding.

#### Scenario: Desktop layout

- GIVEN a 1440 px viewport
- WHEN `/configure` renders
- THEN the side navigation is 240 px wide, sticky at `top: 104px`, beside the content column

### Requirement: Numbered sections and side navigation

The content MUST be divided into sections numbered `01`–`07`: Starting point, Metadata, Settings,
Categories, Applications, Bookmarks, Export. The side navigation MUST list them in order with their
numbers, mark the section currently in view, and move focus/scroll to a section when its item is
activated. Each section MUST be a labelled region (`aria-labelledby` its heading).

#### Scenario: Navigate to a section

- GIVEN the side navigation
- WHEN the user activates `05 Applications`
- THEN the Applications section scrolls into view below the sticky header
- AND its heading receives focus

#### Scenario: Current section indicated

- GIVEN the user scrolls to the Settings section
- WHEN it is the section nearest the top
- THEN `03 Settings` is highlighted in the side navigation with `aria-current="true"`

### Requirement: Starting point cards

The Starting-point section MUST present three option cards — Start empty, Load mounted YAML (only when
a mounted YAML is valid and not a runtime fallback), Import local YAML — with the selected option
visibly highlighted (accent border) and exposed with `aria-pressed` or equivalent radio semantics.

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

Validation errors MUST be listed in a panel headed `Fix the following errors`, using `--down` text and
tint, one item per error with its field path, announced to assistive technology (`role="alert"` or
equivalent) when it appears. Each error MUST remain programmatically associated with its field.

#### Scenario: Errors displayed

- GIVEN a draft with `applications[0].category` referencing a missing category
- WHEN validation runs
- THEN the panel lists `applications[0].category — Category 'iot' does not exist.`
- AND the offending field is described by that message

### Requirement: Switch controls

Boolean settings and flags (show seconds, show date, allow bookmarks, show "Apps" category, show
descriptions, show labels, each search engine, per-app open-in-new-tab, favorite, health check) MUST be
presented as switches: 44 × 26 px track, `role="switch"`, `aria-checked`, visible text label, on state
`--accent`. Toggling MUST change the same draft fields as the former checkboxes.

#### Scenario: Toggle with keyboard

- GIVEN focus on `Show seconds`
- WHEN the user presses Space
- THEN the setting toggles and `aria-checked` reflects the new value

#### Scenario: Same data

- GIVEN the user enables `Show seconds`
- WHEN the draft is exported
- THEN the YAML contains `showSeconds: true` as before

### Requirement: Field styling

Text inputs, selects and textareas MUST be 44 px high (textarea min 44), radius 10, field background
token, 1 px `--line`, with a visible 2 px accent focus ring and a persistent `label` above (13/500).
Monospace is used for path/URL/YAML-like values (IBM Plex Mono).

#### Scenario: Labelled field

- GIVEN any field in the configurator
- WHEN a screen reader reads it
- THEN its visible label is its accessible name

### Requirement: Collection rows and inline editor

Categories, Applications and Bookmarks MUST render as ordered rows showing index, icon (applications),
name, secondary text (id or URL), and a category tag; each row MUST offer move up, move down, edit
and delete as icon buttons with accessible names containing the item name, 44 px hit area on
touch viewports. Edit MUST expand an inline editor panel directly beneath the row (accent-tinted
border) containing that item's fields; only the behaviour of the existing `collection-editor` is
retained (add, remove, reorder, focus management).

#### Scenario: Edit in place

- GIVEN the Applications list
- WHEN the user activates edit on `Mosquitto`
- THEN an inline editor with Name, URL, Description, Icon type, Icon value, Category, Tags, Open in new tab, Favorite, Health check appears under that row
- AND focus moves to the first field

#### Scenario: Reorder announces result

- GIVEN the row `Media`
- WHEN the user activates `Move up`
- THEN the row moves above its predecessor and focus stays on the same button

### Requirement: Export panel

The Export section MUST present `Copy YAML`, `Download YAML` and `Save` actions. When saving needs a
write token, an inline panel MUST appear with a password-type `Write token` field, help text naming
`CONFIG_WRITE_TOKEN`, and `Save token & save` / `Cancel`. The primary action uses `--accent` background
with `--accent-ink` text.

#### Scenario: Token needed

- GIVEN no stored write token
- WHEN the user chooses Save
- THEN the token panel appears with a labelled password field and the help text
- AND `Cancel` closes it without saving

### Requirement: Responsive configurator

At ≤ 900 px the layout MUST become one column: the side navigation becomes a horizontally scrolling
chip bar, sticky at `top: 96px`, full width; at ≤ 600 px the `Back to dashboard` label MUST become
visually hidden (still exposed to assistive technology).

#### Scenario: Tablet

- GIVEN a 800 px viewport
- WHEN `/configure` renders
- THEN the side navigation is a single horizontal row above the content and scrolls sideways

#### Scenario: Phone

- GIVEN a 390 px viewport
- WHEN the header renders
- THEN the back button shows only its icon and its accessible name remains `Back to dashboard`

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
