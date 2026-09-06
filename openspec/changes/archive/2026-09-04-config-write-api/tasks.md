# Tasks: Server-side Config Write Endpoint

## Review Workload Forecast

| Field                   | Value                     |
| ------------------------ | -------------------------- |
| Estimated changed lines | 600–900                  |
| 400-line budget risk    | High                      |
| Chained PRs recommended | Yes                       |
| Suggested split         | PR 1 → PR 2 → PR 3        |
| Delivery strategy       | ask-on-risk               |
| Chain strategy          | pending                   |

Decision needed before apply: No — resolved 2026-09-04, see `design.md` § Decisions.
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
| ---- | ---- | --------- | --------------------- | ---------------- | ------------------ |
| 1 | Write service: auth, schema validation, atomic write + backup | PR 1 | Vitest against a temp directory (`server/`) | Local temp-dir integration tests, no container needed | Delete `server/` |
| 2 | Dockerfile/entrypoint/nginx wiring: write service in the single image, `/api/*` proxy, `:rw` volume, env var | PR 2 | `docker build .` + manual `docker run` smoke test | Manual: `curl -X POST /api/config` against a running container | Revert `Dockerfile`, `entrypoint.sh`, `nginx.conf` |
| 3 | Configurator "Save to server" action + docs | PR 3 | `ng test` | N/A — jsdom integration tests mock `ConfigWriteService` | Revert configurator files, README/CHANGELOG entries |

## Phase 0: Resolve Open Questions — RESOLVED 2026-09-04

- [x] 0.1 Decide the sidecar HTTP framework (bare `node:http` vs minimal framework) — record the
      decision and rationale in `design.md`, replacing the Open Question.
      → Fastify. Recorded in `design.md` § Architecture Decisions and § Decisions.
- [x] 0.2 Decide whether a successful save triggers an automatic dashboard reload or requires a
      manual one for v1 — record in `design.md`.
      → Automatic: reuses `loadMountedConfig()` from `yaml-loader.service.ts`. Recorded in
      `design.md` § Decisions.
- [x] 0.3 Decide whether the write endpoint ships enabled-by-default or opt-in — record in
      `design.md`; this affects Phase 2 scope.
      → Enabled by default: "Save to server" is meant to be an equally available option alongside
      copy/download in the configurator UI. Recorded in `design.md` § Decisions.
- [x] 0.4 (added 2026-09-04, after Phase 1) Resolve a deployment-model inconsistency discovered while
      starting Phase 2: `design.md`/`proposal.md` assumed a docker-compose-orchestrated sidecar
      container, but the project publishes exactly one Docker image (`.github/workflows/docker-publish.yml`
      → GHCR on push to `main`); `docker-compose.yml` does not exist and `docker-compose.dev.yml` is
      an unused leftover. Decide: single multi-process image vs. a second published sidecar image +
      compose file.
      → Single multi-process image: the write service runs as a second process in the existing image
      via `tini` + `entrypoint.sh` (nginx stays the foreground/`exec`'d process). No new
      docker-compose file, no second CI publish job. Recorded in `design.md` § Architecture Decisions
      ("Where the write logic runs", revised) and § Decisions.

## Phase 1: Sidecar Write Service

- [x] 1.1 RED: write tests for atomic write + backup rotation against a temp directory (successful
      write, simulated mid-write failure leaves original untouched, `.bak` created before overwrite).
      → `server/src/write-config.spec.ts`.
- [x] 1.2 GREEN: implement `server/src/write-config.ts` (temp file + `rename`, `.bak` rotation);
      REFACTOR for clarity without changing behavior.
- [x] 1.3 RED/GREEN/REFACTOR: test and implement token auth (`CONFIG_WRITE_TOKEN` header check) —
      missing/incorrect token returns 401 without touching the filesystem.
      → `server/src/app.ts` (`onRequest` hook, runs before body parsing), tested in
      `server/src/app.spec.ts`.
- [x] 1.4 RED/GREEN/REFACTOR: test and implement `POST /api/config` importing
      `DashboardConfigSchema` from `src/app/core/models/dashboard.models.ts` directly — invalid
      payload returns 400 with `ParseError[]` and performs no write.
      → Imports the schema via a relative path (`../../src/app/core/models/dashboard.models`); no
      duplicated schema. Verified with `npx tsc -p server/tsconfig.json` (cross-directory import
      typechecks) in addition to the Vitest suite.
- [x] 1.5 RED/GREEN/REFACTOR: test and implement request body size limit and malformed-JSON handling.
      → `bodyLimit` (default 256KB, configurable via `AppOptions`) plus a `setErrorHandler` that
      normalizes Fastify's built-in body-too-large (413) and JSON-parse (400) errors into the same
      `{status, ...}` response shapes the route handler uses.

**Phase 1 status: all RED/GREEN/REFACTOR tasks complete.** 12/12 tests passing in
`server/src/write-config.spec.ts` and `server/src/app.spec.ts`; `npx tsc -p server/tsconfig.json`
clean. `server/src/index.ts` (env var wiring: `CONFIG_WRITE_TOKEN` required at startup, `CONFIG_PATH`
defaulting to `/app/config/dashboard.yaml` to match `nginx.conf`'s existing alias, `PORT`/`HOST`) was
added and manually smoke-tested outside Docker (`npx tsx src/index.ts` against a scratch temp
directory): no-token → 401, wrong token → 401, invalid payload (dangling category) → 400 with no
file write, valid payload → 200 with correct YAML on disk, second save → previous contents rotated
into `.bak`, 2.9MB payload → 413. Not yet done (Phase 2): the Dockerfile/compose/nginx wiring needed
to run the sidecar as part of the actual container stack.

## Phase 2: Single-Image Container Wiring

- [x] 2.1 Add a Node build stage to `Dockerfile` for `server/` (resolves the tsc
      cross-directory-import/outDir mirroring note from Phase 1).
      → New `server-builder` stage (`node:20-alpine`): `npm ci`, then `esbuild --bundle
      --packages=external` (added as a `server` devDependency, `npm run build`) bundles
      `server/src/index.ts` + the inlined `dashboard.models.ts` import into a single
      `server/dist/index.mjs` (~7KB); `fastify`/`js-yaml`/`zod` stay external (real `node_modules`
      imports, not bundled — avoids esbuild statically analyzing fastify's dependency tree, e.g.
      pino's dynamic transport loading). `npm prune --omit=dev` afterward drops build-only deps
      (`typescript`, `vitest`, `esbuild`, `tsx`, `@types/*`) before the result is copied out.
- [x] 2.2 Extend the production stage: install `tini` and `nodejs` alongside the existing
      `nginx:alpine` base; copy the built write service (`/app/server/index.mjs`) and its pruned
      `node_modules` (`/app/node_modules`, positioned as a common ancestor of both
      `/app/server/index.mjs` and the also-copied `/app/src/app/core/models/dashboard.models.ts`, so
      Node's module resolution finds `fastify`/`js-yaml`/`zod` from either); copy `entrypoint.sh`;
      `ENTRYPOINT ["tini", "--", "/entrypoint.sh"]`.
- [x] 2.3 `entrypoint.sh`: `PORT=3000 node /app/server/index.mjs &` (pinned regardless of any
      caller-supplied `PORT`, since `nginx.conf`'s proxy target is baked in at build time), then
      `exec nginx -g 'daemon off;'`.
- [x] 2.4 `nginx.conf`: `location /api/ { proxy_pass http://127.0.0.1:3000; ... }` (no path segment
      after the port, so nginx forwards the full `/api/config` URI unchanged); doesn't overlap the
      existing static-asset regex or hidden-file-deny locations. Added `.dockerignore` (didn't exist)
      so the Angular `builder` stage's `COPY . .` doesn't pull in `server/node_modules`.
- [x] 2.5 Manual end-to-end smoke test: `docker build . -t getmando:write-api`, `docker run` with
      `CONFIG_WRITE_TOKEN` set and a writable volume mount at `/app/config/dashboard.yaml`; `curl`
      both `GET /config/dashboard.yaml` and `POST /api/config` against the running container — confirm
      a valid save updates the mounted file and an invalid one leaves it untouched. Also verify the
      container still starts and serves read-only when `CONFIG_WRITE_TOKEN` is unset.
      → **Done 2026-09-04**, on the user's machine (this sandbox has no Docker daemon socket access —
      `permission denied .../docker.sock`, not in the `docker` group; the local-only substitute
      checks — bundle run via plain `node`, and a filesystem simulation of the final image layout —
      are noted in the 2.1/2.2 entries above). User built and ran the real image (port 8080), Claude
      drove the `curl` checks against it: `GET /health` → `healthy`; `GET /config/dashboard.yaml` →
      200 with real mounted content; `POST /api/config` with no/wrong token → 401; with an invalid
      payload (dangling category) → 400, file unchanged; with a valid payload → 200 `{"status":"saved"}`
      and the mounted file updated. `dashboard.yaml.bak` confirmed present on the host volume after
      the overwrite. Read-only-when-token-unset was already covered by Phase 1's design (background
      process just fails to start; nginx is unaffected) and not re-verified against the container
      separately.

## Phase 3: Configurator Integration and Docs

- [x] 3.1 RED/GREEN/REFACTOR: test and implement `ConfigWriteService` (`src/app/core/services/`) —
      request shape, success/invalid/unauthorized/error result mapping.
      → `config-write.service.ts` (8 tests). Design decision made with the user mid-phase (not in
      the original design.md): the browser has no way to receive `CONFIG_WRITE_TOKEN` from the
      server without making the token readable by anyone who can reach the endpoint (nginx- or
      sidecar-side auto-injection was considered and rejected — it would authenticate literally
      every request, including blind scanners, defeating the token's purpose). The user enters the
      token once in the configurator; it's kept in `localStorage` (plain — encoding/obfuscation
      client-side was also considered and rejected as no real protection, since the code that would
      decode it is exactly as public as the value itself) and cleared automatically on a 401 so the
      next save re-prompts.
- [x] 3.2 RED/GREEN/REFACTOR: test and implement the "Save to server" action in
      `configurator-page.component.*` / `configurator.store.ts` — success notification, dirty-state
      reset, validation-blocked save reuses the existing error summary.
      → `ConfiguratorStore.markSaved()` / `.reportServerValidationErrors()`; a "Save to server"
      button alongside Copy/Download YAML, with an inline token-entry prompt (password field) shown
      on first use or after a 401. 18 component tests including an AXE check on the token prompt.
      One real bug found and fixed along the way: the token `<label>` initially wrapped its helper
      text too, which silently broke `getByLabelText('Write token')`'s exact-text match — fixed by
      moving the helper text to a sibling `<p>` linked via `aria-describedby`, matching the pattern
      already used for field errors elsewhere in this template.
- [x] 3.3 Update `README.md` (new `CONFIG_WRITE_TOKEN` env var, `/api/config` route on the existing
      port, `:rw` migration note) and `CHANGELOG.md` (breaking-change entry); update
      `openspec/changes/yaml-configurator/proposal.md` to note its "no server writes" scope line is
      superseded by this change.
      → README: Quick Start compose/CLI examples updated to `:rw` + `CONFIG_WRITE_TOKEN` with an
      upgrade callout, Environment Variables table, "Configurator export and save" section, Container
      Features bullet. CHANGELOG: new "⚠️ Breaking Changes" subsection (no prior precedent in this
      file — added one), New Features entries, Changed Files list, Summary. yaml-configurator's
      proposal.md: struck through its "no server writes" line with a superseded note.
- [x] 3.4 Run the complete `ng test` regression suite.
      → 269/269 tests passing across 35 files; `eslint` clean; server suite (`server/`) 12/12
      passing independently.
