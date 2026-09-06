# Proposal: Migrate the config-write service from Fastify to NestJS

## Intent

Re-platform the `server/` write service (`POST /api/config`, ~130 lines of Fastify today) onto
NestJS **at feature parity**, with no change to behaviour, the HTTP contract, environment variables,
Docker packaging, or the frontend. The migration ships nothing a user can see.

Its only purpose is to make the _next_ backend work cheaper. The roadmap discussed — optional auth,
multi-user, moving configuration into a database instead of a single YAML file — is mostly backend:
an auth layer, user/config CRUD, a permissions model, a data store. NestJS gives that work a
structure the current single-file Fastify app does not (modules, DI, guards, interceptors, pipes,
first-class testing), and the port is cheapest to do **now**, while the service is one route, rather
than after several features have been layered onto Fastify.

**This proposal should only be approved if that roadmap is real.** The migration on its own is a
speculative investment: if multi-user / DB work does not happen, it was pure cost. It is small
(~150–250 changed lines, one PR) and fully reversible, but it is still cost with no standalone
payoff.

## Scope

### In Scope

- Port `server/src/` from Fastify to NestJS using the **`@nestjs/platform-fastify`** adapter (keeps
  the current HTTP engine, body-limit semantics, and `app.inject()` test style).
- Preserve the exact HTTP contract of `POST /api/config`:
  - `x-config-token` header checked against `CONFIG_WRITE_TOKEN`; mismatch → `401`, body never read.
  - Body validated against the shared `DashboardConfigSchema` (imported from
    `src/app/core/models/dashboard.models.ts`, not duplicated); failure → `400` with
    `{status: 'invalid', errors: ParseError[]}`.
  - Oversized body → `413 {status: 'error', message}`.
  - Valid config → normalized (`omitBlankBackgroundImages`), dumped to YAML, written atomically
    (temp + fsync + rename) with a rotated `.bak`; success → `200 {status: 'saved'}`.
  - Filesystem failure → `500 {status: 'error', message}`.
- Preserve the environment contract: `CONFIG_WRITE_TOKEN` (required, process exits 1 without it),
  `CONFIG_PATH` (default `/app/config/dashboard.yaml`), `PORT` (3000), `HOST`.
- Keep `writeConfigAtomically` as-is, moved into an injectable service; its tests move with it
  effectively unchanged.
- Keep the `server/` test suite on **Vitest** (repo standard), at parity: the same cases covered
  today (`server/src/app.spec.ts`, `server/src/write-config.spec.ts`) pass against the NestJS app.
- Update the Docker `server-builder` stage to build NestJS output and ship it; keep `entrypoint.sh`,
  `nginx.conf`, and `tini` wiring unchanged except for the artifact path/filename.
- Keep the CI `server` steps (`npm ci`, typecheck, test) added in v2.0.0; adjust `tsconfig.json`
  for decorators.
- Update `ARCHITECTURE.md` "Config Write Sidecar" section and `CHANGELOG.md`.

### Out of Scope

- **Any new endpoint or capability.** No auth system, no user model, no database, no config-in-DB,
  no WebSockets, no GraphQL, no rate limiting. Those are separate proposals that this migration
  merely makes easier.
- Any change to the Angular frontend. `ConfigWriteService`, the configurator, and their tests are
  untouched — the HTTP contract is frozen.
- Any change to the deployment model: still one published Docker image, still nginx + a background
  Node process under `tini`, still `/api/` proxied over loopback, still `:rw` volume.
- Switching the HTTP engine away from Fastify, or switching the test runner to Jest (unless an
  Open Question forces it — see `design.md`).
- Adding `@nestjs/config`, `@nestjs/swagger`, or other NestJS ecosystem packages not needed for
  parity.
- Performance work. The endpoint is called by hand from one browser tab; throughput is irrelevant.

## Capabilities

### New Capabilities

- None. This is a re-platforming of an existing capability.

### Modified Capabilities

- `config-write-api`: unchanged externally (same routes, same request/response shapes, same auth,
  same env vars, same atomic-write guarantees). Its **implementation platform** changes from Fastify
  to NestJS, and its `design.md` "HTTP framework" decision is superseded, not silently overwritten.

## Approach

The service keeps its shape: one authenticated `POST /api/config` route that validates against the
shared Zod schema and writes the mounted YAML atomically. NestJS re-expresses each piece with its
idiomatic building block, so the next feature (a second route, an auth guard, a repository) has an
obvious place to live:

| Today (Fastify)                               | After (NestJS)                                                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `buildApp()` factory in `app.ts`              | `AppModule` + `main.ts` bootstrap                                                                                                       |
| `onRequest` hook: token check before parse    | `ConfigTokenGuard` (`CanActivate`), plus a raw Fastify `onRequest` hook to keep the "body never read on 401" property — see `design.md` |
| inline `DashboardConfigSchema.safeParse`      | a small `ZodValidationPipe` on the route body, error shape preserved                                                                    |
| `setErrorHandler` normalization               | a global `HttpExceptionFilter` mapping to `{status, ...}` shapes                                                                        |
| `dump()` + `writeConfigAtomically` in handler | `ConfigWriterService` (injectable), `write-config.ts` moved in verbatim                                                                 |
| `index.ts` env parsing                        | `main.ts` reads `process.env` directly (no `@nestjs/config` — parity only)                                                              |

The shared-schema import (`server` → `src/app/core/models/dashboard.models.ts`) and the
Docker-time copy of that file plus `node_modules` are kept. The one packaging change is that the
NestJS app can no longer be esbuild-bundled into a single ~7 KB `.mjs` (decorators +
`reflect-metadata` + Nest's dynamic module resolution); the `server-builder` stage ships compiled
`dist/` + a pruned `node_modules` instead. See `design.md` § Bundling for the size budget.

## Affected Areas

| Area                                          | Impact    | Description                                                                                                                           |
| --------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/*.ts`                             | Rewritten | Fastify factory → NestJS module, guard, pipe, filter, service, `main.ts`                                                              |
| `server/package.json`                         | Modified  | Remove `fastify`; add `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-fastify`, `reflect-metadata`, `rxjs`; keep `js-yaml`, `zod` |
| `server/tsconfig.json`                        | Modified  | `experimentalDecorators`, `emitDecoratorMetadata`, `target` bump if needed                                                            |
| `server/vitest.config.ts`                     | Modified  | Add SWC/esbuild decorator support (`unplugin-swc` or equivalent) — see `design.md` § Testing                                          |
| `server/src/*.spec.ts`                        | Modified  | Bootstrap via `Test.createTestingModule()`; assertions and cases unchanged                                                            |
| `Dockerfile` (`server-builder` stage)         | Modified  | `nest build` (or `tsc`) instead of `esbuild --bundle`; copy `dist/` + pruned `node_modules`                                           |
| `entrypoint.sh`                               | Modified  | Artifact path only: `node /app/server/main.js` instead of `index.mjs`                                                                 |
| `nginx.conf`                                  | Unchanged | Still proxies `/api/` to `127.0.0.1:3000`                                                                                             |
| `.github/workflows/test.yml`                  | Unchanged | The `server` `npm ci` / typecheck / test steps still apply as-is                                                                      |
| `ARCHITECTURE.md`                             | Modified  | "Config Write Sidecar" section: s/Fastify/NestJS/, bundling note                                                                      |
| `CHANGELOG.md`                                | Modified  | Internal change entry (no user-facing behaviour change)                                                                               |
| `openspec/changes/config-write-api/design.md` | Modified  | Mark the "HTTP framework: Fastify" decision superseded by this change                                                                 |
| Angular frontend (`src/`)                     | Unchanged | HTTP contract frozen; no frontend change, no frontend test change                                                                     |

## Risks

| Risk                                                                                            | Likelihood | Mitigation                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration delivers zero user value; deprioritised forever or half-done                          | Medium     | Keep it to one small PR; land it **before** any new backend feature; only approve if the multi-user/DB roadmap is committed                                                     |
| Docker image grows from shipping NestJS deps instead of a 7 KB bundle                           | Medium     | Budget: image must not grow more than **25 MB** compressed. Try `nest build --webpack` / SWC single-bundle first; `npm prune --omit=dev`; measure before/after in the PR        |
| Vitest + decorator metadata setup friction in `server/`                                         | Medium     | Spike `unplugin-swc` first (1–2 h timebox). Fallback: Jest for `server/` only, which diverges from the repo Vitest standard and needs explicit sign-off                         |
| "Token checked before body is parsed" security property lost (guards run post-parse)            | Low–Med    | Register a raw Fastify `onRequest` hook on the underlying adapter for the token check; the `bodyLimit` (256 KB) bounds the exposure meanwhile. Decision recorded in `design.md` |
| Error/response shapes drift from the current contract during the rewrite                        | Low        | Parity test suite asserts exact status + body for all six outcomes (401 no token, 401 bad token, 400 invalid, 413 oversized, 200 saved, 500 fs-failure) before merge            |
| Shared-schema cross-directory import breaks under NestJS build                                  | Low        | Same relative import as today; `npm --prefix server run typecheck` (needs root `zod`) stays a CI gate; Docker still copies the model file + `node_modules`                      |
| Startup regressions (missing `CONFIG_WRITE_TOKEN` no longer exits, wrong default `CONFIG_PATH`) | Low        | `main.ts` keeps the explicit `process.env` checks; a test covers "no token → non-zero exit"                                                                                     |

## Rollback Plan

`git revert` the migration PR. Because the HTTP contract, env vars, `nginx.conf`, `entrypoint.sh`
process model, and the entire frontend are unchanged, reverting `server/`, `server/package.json`,
`server/tsconfig.json`, `server/vitest.config.ts`, the `Dockerfile` `server-builder` stage, and the
`entrypoint.sh` artifact path fully restores the Fastify service with no coordinated frontend or
deployment change. No data migration is involved (there is no data store).

## Dependencies

- New runtime deps in `server/package.json`: `@nestjs/core`, `@nestjs/common`,
  `@nestjs/platform-fastify`, `reflect-metadata`, `rxjs`. `fastify` moves from a direct dep to a
  transitive one via the platform adapter.
- New dev dep: an SWC plugin for Vitest decorator support (`unplugin-swc` + `@swc/core`), or the
  equivalent.
- No new frontend dependency. No new infrastructure. No new CI job.

## Success Criteria

- [ ] `POST /api/config` returns byte-identical status codes and response bodies to the current
      Fastify service for all six outcomes: no token (401), wrong token (401), schema-invalid
      payload (400 + `ParseError[]`), oversized body (413), valid payload (200 + file written +
      `.bak` rotated), filesystem failure (500).
- [ ] `x-config-token` mismatch is rejected before the request body is read.
- [ ] `CONFIG_WRITE_TOKEN` unset → process exits non-zero; `CONFIG_PATH` / `PORT` / `HOST` defaults
      unchanged.
- [ ] `server/` Vitest suite covers the same cases as today and passes in CI; `npm --prefix server
  run typecheck` is clean.
- [ ] The Angular frontend and its test suite are unmodified and pass unchanged.
- [ ] `docker build` succeeds; a manual `curl` smoke test against the running image shows parity;
      the compressed image is no more than 25 MB larger than the previous release.
- [ ] `ARCHITECTURE.md` and `CHANGELOG.md` reflect the platform change; the superseded Fastify
      decision in `config-write-api/design.md` is marked, not deleted.
- [ ] The change is a single reviewable PR (or a 2-PR chain: framework port, then Docker/CI), each
      independently revertible.
