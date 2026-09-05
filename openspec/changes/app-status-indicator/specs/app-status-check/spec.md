# App Status Check Specification

## Purpose

Let users see, at a glance, whether an opted-in self-hosted app is reachable, by checking it from the
server (not the viewer's browser) and exposing the cached result over a read-only endpoint the
dashboard polls.

## Requirements

### Requirement: Opt-in per app

The system MUST support a `healthCheck` boolean field on each application, defaulting to `false`.
Only applications with `healthCheck: true` MUST be checked.

#### Scenario: Default parsing
- GIVEN an application without `healthCheck` in YAML
- WHEN the config is parsed
- THEN `healthCheck` equals `false`
- AND the application is never checked

#### Scenario: Opted-in application is checked
- GIVEN an application with `healthCheck: true`
- WHEN a poll cycle runs
- THEN a check request is made to the application's `url`

### Requirement: Reachability check semantics

The system MUST treat any HTTP response, regardless of status code, as `up`. The system MUST treat a
network-level failure (connection refused, reset, DNS failure) or a request that does not complete
within the configured timeout as `down`. The system MUST accept self-signed or otherwise invalid TLS
certificates for this check specifically, without weakening TLS verification for any other request in
the process.

#### Scenario: Any status code counts as up
- GIVEN an app that responds with `401`
- WHEN it is checked
- THEN its status is `up`

#### Scenario: Connection failure counts as down
- GIVEN an app whose port refuses connections
- WHEN it is checked
- THEN its status is `down`

#### Scenario: Timeout counts as down
- GIVEN an app that never responds
- WHEN the per-check timeout elapses
- THEN its status is `down`

#### Scenario: Self-signed certificate does not count as down
- GIVEN an HTTPS app serving a self-signed certificate
- WHEN it is checked
- THEN its status is `up`

### Requirement: Background polling independent of write access

The system MUST run checks on a recurring interval (`STATUS_CHECK_INTERVAL_MS`, default `60000`)
regardless of whether `CONFIG_WRITE_TOKEN` is configured. The system MUST NOT require a valid write
token to serve status results.

#### Scenario: Status checks run without a write token
- GIVEN the sidecar starts with no `CONFIG_WRITE_TOKEN` set
- WHEN a poll cycle elapses
- THEN opted-in apps are still checked
- AND `GET /api/status` still returns their results

### Requirement: Status endpoint

The system MUST expose `GET /api/status`, unauthenticated, returning the current cached results and
the configured check interval. The system MUST NOT include an application's `url` or any other
configuration field in the response.

#### Scenario: Response shape
- GIVEN at least one `healthCheck: true` app has been checked
- WHEN `GET /api/status` is called
- THEN the response is `200` with `{ intervalMs, apps: { [appId]: { status, checkedAt } } }`
- AND no `url` or other config field appears anywhere in the response

#### Scenario: Response before any check has completed
- GIVEN the sidecar has just started and no poll cycle has completed yet
- WHEN `GET /api/status` is called
- THEN the response is `200` with an empty `apps` object

### Requirement: Frontend poll cadence tracks the server's interval

The system MUST derive its polling interval from the server's reported `intervalMs` rather than a
hardcoded frontend constant, and MUST perform an initial request before scheduling any recurring poll.

#### Scenario: Frontend adopts the reported interval
- GIVEN `GET /api/status` reports `intervalMs: 30000`
- WHEN the frontend schedules its next poll
- THEN it waits 30000ms (or `MIN_POLL_MS`, whichever is greater) before polling again

### Requirement: Bounded retry on failure

The system MUST retry a failed poll at a flat interval (`RETRY_INTERVAL_MS`) up to a fixed number of
attempts (`MAX_RETRIES`), and MUST stop polling entirely for the rest of that page's lifetime once all
retries are exhausted, rather than retrying indefinitely.

#### Scenario: Recovery within the retry window
- GIVEN a poll fails and a retry is scheduled
- WHEN a subsequent retry within `MAX_RETRIES` succeeds
- THEN normal interval-driven polling resumes
- AND the retry count resets

#### Scenario: Retries exhausted
- GIVEN `MAX_RETRIES` consecutive polls have failed
- WHEN the last retry's delay elapses
- THEN no further request is scheduled
- AND previously known statuses remain displayed unchanged
