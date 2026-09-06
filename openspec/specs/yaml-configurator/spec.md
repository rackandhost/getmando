# YAML Configurator Specification

## Purpose

Provide an accessible workflow for creating, importing, validating, editing, and exporting
configuration without changing deployed dashboard or writing server-side.

## Requirements

### Requirement: Lazy configurator entry

The application MUST expose the configurator at `/configure` through a lazy-loaded route, while
preserving the existing dashboard behavior at `/`.

#### Scenario: Direct navigation

- GIVEN the application is running
- WHEN a user navigates directly to `/configure`
- THEN the configurator loads without requiring dashboard interaction
- AND navigating to `/` continues to show the dashboard

### Requirement: Choose an initial configuration source

When a valid YAML configuration is mounted, the configurator MUST offer exactly these actions: load
the mounted configuration or start empty. A runtime fallback MUST NOT be presented as mounted YAML.

#### Scenario: Mounted YAML is valid

- GIVEN the loader reports a valid mounted YAML configuration
- WHEN the configurator opens
- THEN the user can choose Load mounted configuration or Start empty
- AND the choice determines the initial draft

#### Scenario: Mounted YAML is unavailable

- GIVEN the loader reports no mounted configuration or a runtime fallback
- WHEN the configurator opens
- THEN the user starts with an empty draft
- AND no misleading mounted-load option is offered

### Requirement: Start normally without mounted YAML

A missing mounted YAML file (HTTP 404) MUST be treated as a normal initial state. The dashboard
MUST use its default configuration without a configuration warning toast or warning/error
diagnostic. The default configuration MUST contain no user categories; the category service
MUST provide the single virtual Apps category. The mounted outcome MUST remain missing so the
configurator starts empty.

#### Scenario: First startup without YAML

- GIVEN no dashboard YAML file exists
- WHEN the application starts
- THEN the category selector shows exactly one Apps button
- AND no configuration warning toast appears
- AND the missing request is not retried
- AND the configurator starts with an empty draft

#### Scenario: Existing YAML cannot be used

- GIVEN the mounted YAML is invalid or its request fails with a status other than 404
- WHEN the application falls back to defaults after any transient retries
- THEN one configuration warning toast appears
- AND diagnostics describe the failure

### Requirement: Import and edit a draft

The configurator MUST allow local YAML import and editing of settings, categories, applications, and
bookmarks in a draft separate from validated configuration state.

#### Scenario: Import valid local YAML

- GIVEN a user selects a local YAML file containing a structurally valid configuration
- WHEN import completes
- THEN the configuration is loaded into editable draft fields
- AND the draft is not sent to a server

#### Scenario: Import or edit invalid data

- GIVEN imported or edited data is structurally invalid
- WHEN validation runs
- THEN the draft remains editable
- AND the UI identifies affected fields with actionable messages

### Requirement: Enforce semantic validation

Before export, the configurator MUST reject drafts with duplicate IDs, nonexistent category
references, or IDs reserved for virtual categories. Messages MUST identify each failing constraint
and its relevant field or item.

#### Scenario: Semantic constraints pass

- GIVEN a draft has unique permitted IDs and valid category references
- WHEN validation runs
- THEN the draft is considered exportable

#### Scenario: Semantic constraints fail

- GIVEN a draft violates one or more semantic constraints
- WHEN the user requests export
- THEN export is blocked
- AND each violation is reported without discarding unrelated draft edits

### Requirement: Export canonical dashboard YAML

The configurator MUST serialize an exportable draft as normalized canonical YAML named `dashboard.yaml`.
Serialization MUST NOT preserve source comments or formatting.

#### Scenario: Copy export

- GIVEN the draft passes structural and semantic validation
- WHEN the user chooses Copy YAML
- THEN canonical `dashboard.yaml` content is copied to the clipboard
- AND the UI confirms success or reports a safe, actionable clipboard failure

#### Scenario: Download export

- GIVEN the draft passes structural and semantic validation
- WHEN the user chooses Download
- THEN a file named `dashboard.yaml` is downloaded with canonical content
- AND no server write is attempted

### Requirement: Accessible and non-persistent workflow

The configurator MUST meet WCAG AA and AXE checks, provide keyboard-operable collection editing,
stable focus, and associated labels/errors. It MUST NOT autosave drafts, use local storage, or write
generated configuration to a server.

#### Scenario: Keyboard and validation accessibility

- GIVEN a user edits nested collections using a keyboard
- WHEN an item is added, removed, focused, or invalid
- THEN controls remain operable and focus is intentionally managed
- AND labels and validation errors are programmatically associated

#### Scenario: Session ends without persistence

- GIVEN a user has an incomplete or complete draft
- WHEN the configurator is reloaded
- THEN no draft is restored from browser storage
- AND the dashboard or server configuration remains unchanged
