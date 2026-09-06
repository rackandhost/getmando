# Config Write API Specification

## Purpose

Let a validated dashboard configuration be persisted directly to the mounted `dashboard.yaml` over
HTTP, removing the manual download-and-copy step, without introducing a database — YAML remains the
single source of truth on disk.

## Requirements

### Requirement: Authenticated write endpoint

The system MUST expose `POST /api/config` and MUST reject any request that does not carry a valid
`CONFIG_WRITE_TOKEN` before reading or validating its body.

#### Scenario: Missing or incorrect token

- GIVEN the sidecar is configured with a `CONFIG_WRITE_TOKEN`
- WHEN a request to `POST /api/config` omits the token header or sends an incorrect value
- THEN the response is `401`
- AND the mounted `dashboard.yaml` is not read or modified

#### Scenario: Valid token

- GIVEN a request carries the correct `X-Config-Token` header
- WHEN the request body is a structurally and semantically valid configuration
- THEN the request proceeds to validation and write

### Requirement: Server-side schema validation

The endpoint MUST validate every request body against the same `DashboardConfigSchema` used by the
browser configurator, imported directly rather than duplicated, and MUST NOT write anything to disk
when validation fails.

#### Scenario: Invalid payload rejected

- GIVEN a request body that violates structural or semantic constraints (duplicate IDs, dangling
  category references, reserved IDs, etc.)
- WHEN `POST /api/config` is called
- THEN the response is `400` with errors identifying each failing field
- AND the mounted `dashboard.yaml` is unchanged

#### Scenario: Valid payload accepted

- GIVEN a request body that satisfies `DashboardConfigSchema`
- WHEN `POST /api/config` is called with a valid token
- THEN the file write proceeds

### Requirement: Atomic, backed-up write

Every accepted write MUST be atomic with respect to the target file and MUST preserve the prior
contents in a rotated backup before the new content replaces it.

#### Scenario: Successful save

- GIVEN a valid, authenticated request
- WHEN the write completes
- THEN `dashboard.yaml` contains exactly the new configuration
- AND `dashboard.yaml.bak` contains what `dashboard.yaml` held immediately before the write

#### Scenario: Write failure leaves the original intact

- GIVEN a valid, authenticated request
- WHEN the write to the temporary file or the rename step fails for any reason
- THEN the previously mounted `dashboard.yaml` is left byte-for-byte unchanged
- AND the response reports the failure without a partial file on disk

### Requirement: Configurator save action

The configurator MUST offer a "Save to server" action that calls this endpoint with the current
validated draft, in addition to the existing copy/download actions, which MUST continue to work
unchanged for deployments that do not run the write-capable sidecar.

#### Scenario: Save from the configurator

- GIVEN a draft passes the same structural and semantic validation already enforced before export
- WHEN the user chooses Save to server
- THEN the draft is sent to `POST /api/config`
- AND a success or actionable failure notification is shown
- AND on success the store's dirty state is cleared

#### Scenario: Save endpoint unavailable

- GIVEN the write endpoint is unreachable, disabled, or misconfigured
- WHEN the user chooses Save to server
- THEN a clear, actionable failure notification is shown
- AND copy/download remain available as fallbacks

### Requirement: Client-side write token entry

Because the write endpoint has no session system, the configurator MUST let the user supply the
same `CONFIG_WRITE_TOKEN` value out of band and MUST NOT obtain it automatically from the server, since
any mechanism that does so would authenticate every request equally, including one that never
rendered the page.

#### Scenario: First save prompts for the token

- GIVEN a valid draft and no token stored in this browser
- WHEN the user chooses Save to server
- THEN a token entry field is shown instead of an immediate request
- AND submitting it stores the token in this browser and proceeds with the save

#### Scenario: Stored token is reused

- GIVEN a token is already stored in this browser
- WHEN the user chooses Save to server
- THEN the request is sent immediately without prompting

#### Scenario: Rejected token is cleared

- GIVEN a stored token that the server no longer accepts
- WHEN `POST /api/config` responds `401`
- THEN the stored token is cleared
- AND the token entry field is shown again on the next attempt

### Requirement: Documented breaking deployment change

Because this change moves the mounted config volume from read-only to read-write by default, the
project MUST document the migration for existing self-hosted deployments and MUST keep the
application serving correctly in read-only mode when the sidecar or token is absent.

#### Scenario: Upgrading an existing deployment

- GIVEN a user already runs the dashboard with the config volume mounted `:ro`
- WHEN they upgrade to a version that ships this change without following the migration note
- THEN the dashboard continues to serve the existing mounted `dashboard.yaml` read-only
- AND only the new "Save to server" action fails, with copy/download remaining available
