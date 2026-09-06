# Proposal: Server-side Config Write Endpoint

## Intent

Let the configurator save a validated draft directly to the mounted `dashboard.yaml`, removing the
manual "download, then copy into the volume by hand" step that risks a corrupted or half-written
file. YAML remains the single source of truth; no database is introduced by this change.

## Scope

### In Scope
- A minimal write-capable backend service alongside nginx, exposing `POST /api/config`.
- Reuse of the existing `DashboardConfigSchema` (Zod, no Angular dependency) to validate the payload
  before any write — the same boundary the configurator already enforces in-browser.
- Atomic write to `/app/config/dashboard.yaml` (write to a temp file, then rename) with a rotated
  `.bak` copy of the previous contents taken before every overwrite.
- Minimal shared-secret authentication on the write endpoint (a token header checked against an
  environment variable), since the endpoint has no user/session system to lean on.
- `Dockerfile`/`nginx.conf` changes required to run the write service alongside nginx in the single
  published image and route `/api/*` to it (see `design.md` § Technical Approach, revised 2026-09-04:
  the project ships one image via `docker-publish.yml`, not a docker-compose stack, so the write
  service runs as a second process in that same image rather than a separate container).
- A "Save to server" action in the configurator, alongside the existing copy/download actions (kept
  as-is for users who don't run the write-capable image).
- Documentation of the breaking change: the config volume moves from `:ro` to `:rw`.

### Out of Scope
- Multiuser support, per-user accounts, or session-based auth.
- SQLite or any database-backed storage — this change intentionally keeps YAML as the only format;
  a DB-backed store was considered and deferred (see conversation history / Open Questions in
  `design.md`).
- Change history, diffing, or a versioned/undo UI beyond the single rotated `.bak`.
- Conflict resolution for concurrent writers — single-user, last-write-wins is acceptable for v1.
- Rate limiting or IP allow-listing beyond the shared-secret token.

## Capabilities

### New Capabilities
- `config-write-api`: Validate and atomically persist a dashboard configuration to the mounted YAML
  file over HTTP.

### Modified Capabilities
- `yaml-configurator`: adds a "Save to server" action; its proposal's prior "Out of Scope: Server-side
  writes or automatic deployment of generated YAML" no longer holds once this change ships and should
  be superseded, not silently ignored.

## Approach

Run a small Node service alongside nginx **in the same container** (not a separate sidecar container
— the project publishes exactly one Docker image via `docker-publish.yml`, so a second container
would force every user to start orchestrating multiple containers just for this feature) that imports
`src/app/core/models/dashboard.models.ts` directly for validation — the file has no Angular
dependency, so the exact same schema the browser uses guards the write, with no risk of the two
drifting apart. `tini` + a small `entrypoint.sh` start the write service in the background and then
run nginx in the foreground, so both share the container's process lifecycle. nginx proxies `/api/*`
to the write service over loopback; everything else continues to be served as static files exactly as
today. The write service writes atomically (temp file + rename) and keeps one rotated backup before
every overwrite.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/` (new) | Done | Node/TypeScript write service: route, validation, atomic write, auth (Phase 1 complete) |
| `Dockerfile` | Modified | Add a Node build stage for `server/`; final stage installs `tini` + Node runtime, copies the built write service alongside nginx |
| `entrypoint.sh` (new) | New | Starts the write service in the background, `exec`s nginx in the foreground |
| `nginx.conf` | Modified | `proxy_pass` for `/api/*` to the write service over loopback |
| `src/app/features/configurator/` | Modified | "Save to server" action and its service call |
| `src/app/core/services/` | New/Modified | `config-write.service.ts` (or similar) for the HTTP call |
| `README.md`, `CHANGELOG.md` | Modified | Breaking-change migration note, new env var |
| `openspec/changes/yaml-configurator/proposal.md` | Modified | Note the superseded "no server writes" claim |

`docker-compose.yml` does not exist in this project (confirmed 2026-09-04) and `docker-compose.dev.yml`
is an unused leftover from an earlier local-dev workflow — neither is touched by this change.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `:ro` → `:rw` breaks existing self-hosted deployments silently on upgrade | High | Call out prominently in CHANGELOG/README; keep the app working read-only if the write service/token is absent |
| `/api/config` shares the dashboard's public port (revised 2026-09-04 — single image, no separate sidecar port to firewall off) — anyone who can reach the dashboard can reach the write endpoint | Medium | `CONFIG_WRITE_TOKEN` is the only gate; document prominently that this is not a substitute for network-level access control on internet-exposed deployments |
| Partial/concurrent writes corrupt `dashboard.yaml` | Low | Atomic temp-file + rename, plus `.bak` before overwrite |
| Validation drifts between browser and server over time | Low | Import the same `dashboard.models.ts` schema file rather than duplicating it |
| Image size / attack surface grows from adding a Node runtime, now present in every deployment by default | Low | Keep the write service to one route (Fastify, no ORM/templating/session middleware); `tini` is a single small Alpine package |
| Write-service process crashes and isn't noticed (revised 2026-09-04 — it's a background process in the same container, not its own container Docker would restart) | Low | `entrypoint.sh` backgrounds it under `tini`, which reaps it; document that "Save to server" failing consistently across container restarts is the signal to check logs — no auto-restart-on-crash for v1 |

## Rollback Plan

Revert `Dockerfile`/`entrypoint.sh` to drop the write service and Node runtime, restore `nginx.conf`
to serve `/config/dashboard.yaml` as a static alias only with no `/api/*` proxy, revert the documented
volume mount to `:ro`, and remove the "Save to server" action from the configurator (copy/download
remain unaffected, since they already exist independently).

## Dependencies

- A Node runtime added to the single published image (no new container — see `design.md` §
  Technical Approach, revised 2026-09-04); HTTP framework is Fastify (resolved in `design.md`).
- No new frontend dependency: the existing Zod schema and Angular `HttpClient` are reused.

## Success Criteria

- [ ] A valid draft can be saved from `/configure` directly to the mounted `dashboard.yaml` with no
      manual file copy.
- [ ] An invalid payload is rejected by the same semantic rules the browser already enforces, and the
      file on disk is left untouched.
- [ ] A failed or interrupted write never leaves `dashboard.yaml` truncated or partially written.
- [ ] The write endpoint refuses requests without a valid token.
- [ ] Existing copy/download export flows keep working unchanged.
- [ ] The breaking `:ro` → `:rw` volume change is documented with an upgrade note.
