# Design: Server-side Config Write Endpoint

## Technical Approach

**Revised 2026-09-04** (see the first Architecture Decision row below): the project ships exactly one
Docker image — `docker-publish.yml` builds `Dockerfile` and pushes a single image to GHCR on every
push to `main`; there is no production `docker-compose.yml`, and `docker-compose.dev.yml` is a
leftover from an earlier local-dev workflow that is no longer used. A second "sidecar container"
would force every user to start orchestrating two containers (or wait for a second published image)
just to get "Save to server", which breaks that one-image deployment model. So the write service runs
as a second process **inside the same image and container**, not a separate container: `tini` (PID 1,
already tiny and Alpine-friendly) starts an `entrypoint.sh` that launches the Node write service in
the background and then `exec`s nginx in the foreground, so both processes share the container's
lifecycle and `tini` reaps/forwards signals for both. nginx keeps serving all static assets and the
read path (`GET /config/dashboard.yaml` via `alias`) exactly as today; it additionally proxies
`/api/*` to the write service over `127.0.0.1:<port>` (loopback — the write service is never exposed
directly). The write service's only job is `POST /api/config`: authenticate, validate against
`DashboardConfigSchema`, and atomically overwrite the mounted file. The Angular side gets a thin
service that POSTs the current draft and surfaces success/failure through the existing
`NotificationService`.

## Architecture Decisions

| Decision | Options and tradeoff | Choice and rationale |
|---|---|---|
| Where the write logic runs | (a) Multi-process image (nginx + node, supervised) vs (b) separate sidecar container | **Revised 2026-09-04**: (a), multi-process single image. Originally chosen as (b) on the assumption the project already models multi-container deployments via compose — that assumption was wrong: the project publishes exactly one image (`docker-publish.yml` → GHCR) and has no production compose file, so a second container would force a deployment-model change on every user just for this feature. `tini` + an `entrypoint.sh` (start the Node service in the background, `exec nginx` in the foreground) keeps this to a two-line process-supervision addition rather than a new orchestration requirement, while still isolating the write service in its own OS process with its own crash domain. |
| HTTP framework | Plain `node:http` vs a minimal framework (e.g. Fastify) vs Express | Fastify: schema-first request/response validation and built-in body-size limiting cut boilerplate versus bare `node:http`, and the service stays a single route, so the extra dependency stays scoped and justified. |
| Validation source | Duplicate a schema in the sidecar vs import `dashboard.models.ts` directly | Import directly. The file only depends on `zod`, so the sidecar's `package.json` needs just `zod`, and the browser and server can never validate differently. |
| Write strategy | Direct `fs.writeFile` vs atomic temp-file + rename | Atomic: write to `dashboard.yaml.tmp`, `fsync`, then `rename()` over the target (rename is atomic on the same filesystem). Copy the current file to `dashboard.yaml.bak` before the rename so one restore point always exists. |
| Auth | None vs shared-secret header vs full auth system | Shared-secret header (`X-Config-Token` checked against `CONFIG_WRITE_TOKEN` env var). No user system exists to build real auth on top of; a full auth system is out of scope per the proposal. Document that this is not a substitute for network-level access control. |
| Volume mount | Keep `:ro` and require a manual mount change vs default the shipped image's documented mount to `:rw` | Documented default becomes `:rw` (breaking, called out in README/CHANGELOG); the app must still start and serve read-only if the volume stays `:ro` (the write service just gets a 500 on every write attempt — no crash loop), so existing deployments degrade to current behavior rather than breaking. |
| Process supervision (new, 2026-09-04) | Bare shell `&` backgrounding vs a minimal init (`tini`) vs a full supervisor (`supervisord`) | `tini`: ~5-line entrypoint, already the de-facto minimal Docker init (handles signal forwarding and zombie reaping for both processes), tiny Alpine package. `supervisord` adds a Python runtime and a config file for one process pair — more than this needs. |

## Data Flow

```text
configurator "Save to server"
    -> ConfigWriteService.save(config)
    -> POST /api/config  { config, token via header }
    -> nginx proxy_pass /api/* -> http://127.0.0.1:<write-service-port>  (same container, loopback)
    -> write service: auth check -> DashboardConfigSchema.safeParse
                                  |-- invalid --> 400 { errors: ParseError[] }
                                  |-- valid   --> backup current file to .bak
                                                  write dashboard.yaml.tmp
                                                  rename -> dashboard.yaml
                                                  200 { status: 'saved' }
    -> ConfigWriteService surfaces result via NotificationService
```

The existing `GET /config/dashboard.yaml` read path and `loadMountedConfig()` flow in
`yaml-loader.service.ts` are unchanged; a successful save should trigger the same reload path the app
already uses so the running dashboard picks up the new file without a manual refresh instruction.

## File Changes

| File | Action | Description |
|---|---|---|
| `server/src/index.ts` | Done | Write service entry point: env vars, `app.listen()` |
| `server/src/app.ts`, `server/src/write-config.ts` | Done | Fastify app: auth, schema validation, atomic write + backup |
| `server/package.json`, `server/tsconfig.json` | Done | Minimal package; depends on `fastify`, `js-yaml`, `zod`; imports `dashboard.models.ts` directly |
| `Dockerfile` | Modify | Add a Node build stage for `server/`; final stage installs `tini` + a Node runtime alongside nginx, copies the built write service, adds `entrypoint.sh` |
| `entrypoint.sh` (new) | Create | Starts the write service in the background, then `exec`s nginx in the foreground; `tini` is PID 1 |
| `nginx.conf` | Modify | Add `location /api/ { proxy_pass http://127.0.0.1:<port>; }` |
| `src/app/core/services/config-write.service.ts` | Create | `save(config): Observable<...>` HTTP call + error mapping |
| `src/app/features/configurator/configurator-page.component.*` | Modify | "Save to server" action, disabled/hidden if the endpoint is unavailable |
| `src/app/features/configurator/configurator.store.ts` | Modify | Wire save intent, dirty-state reset on success |
| `README.md` | Modify | New env var, `:rw` migration note (no new port — `/api/*` is same-origin via nginx) |
| `CHANGELOG.md` | Modify | Breaking-change entry |
| `openspec/changes/yaml-configurator/proposal.md` | Modify | Note the "no server writes" out-of-scope line is superseded by this change |

`docker-compose.yml` does not exist in this project and `docker-compose.dev.yml` is an unused
leftover from an earlier local-dev workflow (confirmed 2026-09-04) — neither is touched by this
change. The single `Dockerfile`, built and published by `.github/workflows/docker-publish.yml`, is
the only deployment artifact.

## Interfaces / Contracts

```ts
// Request
POST /api/config
Headers: { 'X-Config-Token': string }
Body: DashboardConfig // same shape validated by DashboardConfigSchema

// Responses
200 { status: 'saved' }
400 { status: 'invalid'; errors: ParseError[] }   // reuse the existing ParseError shape
401 { status: 'unauthorized' }
500 { status: 'error'; message: string }          // write/backup failure
```

```ts
// src/app/core/services/config-write.service.ts (implemented)
export type ConfigWriteResult =
  | { readonly status: 'saved' }
  | { readonly status: 'invalid'; readonly errors: readonly ParseError[] }
  | { readonly status: 'unauthorized' | 'error'; readonly message: string };

// hasToken() / setToken(token) manage a localStorage-persisted token; save(config) returns
// 'unauthorized' immediately (no request) when none is stored, and clears it on a 401 response.
```

### How the browser gets the token

This was an open gap the sketch above didn't address: `CONFIG_WRITE_TOKEN` is a server-side secret,
but the configurator runs in an arbitrary visitor's browser, which has no access to the container's
environment. Two ways for the server to hand the token to the browser automatically were considered
and rejected, because both make the token authenticate literally any request, including one that
never rendered the page (a blind scanner) — i.e. equivalent to no token at all:

- nginx injecting `X-Config-Token` on every proxied `/api/*` request (env-var templating at
  container start).
- The sidecar exposing a `GET` endpoint that returns the token to whoever asks.

Resolved: the user pastes the same value they set as `CONFIG_WRITE_TOKEN` into a password-type field
in the configurator, once. `ConfigWriteService` stores it in `localStorage` (same-origin isolated —
protects against the common case of an unrelated site or a blind internet request; does **not**
protect against someone with access to that specific browser profile, an XSS bug, or a malicious
extension, since no client-side-only mechanism can — the decrypting code would be exactly as
readable as the token itself). Storing it in plaintext rather than "encoded" is a deliberate,
discussed choice: encoding (e.g. base64) is trivially reversible and provides no additional
protection, so it would only manufacture false confidence. A 401 response clears the stored token so
the next save re-prompts instead of failing silently forever.

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Unit (sidecar) | Atomic write, backup rotation, auth check, schema rejection | Node test runner or Vitest against a mocked/temp filesystem |
| Unit (Angular) | `ConfigWriteService` request shape and result mapping | Vitest with `HttpTestingController` |
| Integration (Angular) | Save button flow: success notification, dirty-state reset, validation-blocked save | Angular Testing Library with a mocked `ConfigWriteService` |
| Integration (sidecar) | End-to-end request against a real temp directory: valid save, invalid payload, missing/bad token, concurrent write doesn't corrupt the file | Supertest-equivalent against the sidecar's HTTP handler |
| E2E | N/A | No E2E harness exists in this project (see `yaml-configurator/design.md`); covered by the integration layers above |

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Unauthenticated write | Applicable — new network-writable endpoint | `CONFIG_WRITE_TOKEN` required on every write | Missing/incorrect token → 401, no write occurs |
| Payload validation bypass | Applicable | Server re-validates with the same Zod schema; never trusts the client | Structurally/semantically invalid payload → 400, file untouched |
| Partial write / corruption | Applicable | Temp file + atomic rename, `.bak` before overwrite | Simulated failure mid-write leaves original file intact |
| Path traversal | N/A — target path is a fixed constant, never derived from the request | No user-controlled path | None |
| Oversized payload / DoS | Applicable, low severity for v1 | Body size limit at the HTTP layer | Oversized body → rejected before parsing |

## Migration / Rollout

Breaking change: the documented volume mount for the single shipped image moves from `:ro` to `:rw`,
and the image gains a new required-for-write env var (`CONFIG_WRITE_TOKEN`). Existing self-hosted
users pull the new image tag as usual (same `docker run`/manifest they already have) and update their
own volume mount and env var to opt into writing, or leave the mount `:ro` and skip
`CONFIG_WRITE_TOKEN` — the write service then returns `500` on every save attempt while the rest of
the app (including reads) keeps working exactly as before. Call this out as a major/minor version
bump per the project's existing versioning practice, with an explicit upgrade note in `README.md` and
`CHANGELOG.md`.

## Decisions (resolved 2026-09-04)

- **HTTP framework**: Fastify. See the Architecture Decisions row above.
- **Auto-reload on save**: Yes — a successful `POST /api/config` triggers the same
  `loadMountedConfig()` flow `yaml-loader.service.ts` already uses, so the running dashboard reflects
  the new file without a manual refresh. (The Data Flow section above already assumed this; it's now
  a confirmed decision rather than an open one.)
- **Token scoping**: A single shared-secret token (`CONFIG_WRITE_TOKEN`) is sufficient for v1, per the
  Auth row above. Scoped or rotatable tokens are out of scope — there is no user/session system to
  build that on top of, and the proposal already excludes multiuser/session auth.
- **Enabled by default**: The write service starts by default whenever the image runs (no opt-in
  flag) — "Save to server" is meant to sit alongside copy/download as an equally-available option in
  the configurator UI. Users who want the dashboard to stay read-only keep the volume `:ro` and don't
  set `CONFIG_WRITE_TOKEN`; the app keeps serving correctly in that case (see Migration / Rollout
  above).
- **Single-image deployment (revised 2026-09-04)**: superseded the original "sidecar container" framing
  — see the "Where the write logic runs" row in Architecture Decisions. The project publishes one
  Docker image; the write service runs as a second process in that same image/container via `tini` +
  `entrypoint.sh`, not as a second container. No `docker-compose.yml` is introduced.
