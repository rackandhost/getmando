# Design: Migrate the config-write service from Fastify to NestJS

## Technical Approach

The service stays a single authenticated route that validates against the shared
`DashboardConfigSchema` and writes the mounted YAML atomically. NestJS re-expresses it as a minimal
module so that later additions (a second route, an auth guard, a config repository, a DB module)
have a conventional home instead of accreting onto one `buildApp()` function.

Target layout:

```text
server/
  src/
    main.ts                     bootstrap: read env, create Nest app (Fastify adapter), listen
    app.module.ts               wires the controller, guard, pipe, filter, and writer service
    config/
      config.controller.ts      POST /api/config
      config-token.guard.ts     x-config-token === CONFIG_WRITE_TOKEN
      zod-validation.pipe.ts     DashboardConfigSchema.safeParse -> 400 { status:'invalid', errors }
      config-writer.service.ts   omitBlankBackgroundImages -> js-yaml.dump -> writeConfigAtomically
      write-config.ts            unchanged: temp + fsync + rename, .bak rotation
    common/
      http-exception.filter.ts   normalize 413 / 400 / 500 into { status, ... } shapes
  test/
    config.e2e-spec.ts           parity suite via Test.createTestingModule() + app.inject()
    write-config.spec.ts         moved verbatim from src/
```

`main.ts` keeps the explicit environment handling from today's `index.ts` — no `@nestjs/config`,
because parity does not need it and it would widen scope:

```ts
const token = process.env.CONFIG_WRITE_TOKEN;
if (!token) {
  console.error('CONFIG_WRITE_TOKEN is required to start the config-write-api service.');
  process.exit(1);
}
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule.forRoot({ token, targetPath: process.env.CONFIG_PATH ?? '/app/config/dashboard.yaml' }),
  new FastifyAdapter({ bodyLimit: 256 * 1024 }),
);
await app.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '0.0.0.0');
```

The `bodyLimit` moves onto the `FastifyAdapter`; the token and target path are passed into the
module via a `forRoot()` static factory so tests can construct the app with a scratch temp directory
exactly as `buildApp({ configWriteToken, targetPath })` allows today.

nginx, `entrypoint.sh`, `tini`, the loopback proxy, and the `:rw` volume are all unchanged. The
frontend `ConfigWriteService` still sends `X-Config-Token` and still branches on
`saved` / `invalid` / `unauthorized` / `error`.

## Architecture Decisions

| Decision                | Options and tradeoff                                                                                                                                | Choice and rationale                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Do the migration at all | (a) stay on Fastify and add structure by hand later; (b) port to NestJS now                                                                         | (b), **conditional on the multi-user/DB roadmap being committed.** The port is ~130 LOC today and grows with every backend feature added to Fastify first. If the roadmap is not real, stay on Fastify — this proposal is then withdrawn, not shipped "just in case".                                                                                                                            |
| HTTP engine             | `@nestjs/platform-express` vs `@nestjs/platform-fastify`                                                                                            | **platform-fastify.** Keeps the current engine, the `bodyLimit` mechanism, and `app.inject()` in tests. Lighter than Express. Supersedes the `config-write-api/design.md` "Fastify" row — same engine, now under Nest.                                                                                                                                                                           |
| Token check ordering    | (a) NestJS `CanActivate` guard only (runs after Fastify has parsed the body); (b) guard + a raw Fastify `onRequest` hook on the underlying instance | **(b).** Today's `onRequest` hook guarantees an unauthorized request's payload is never read. A Nest guard alone loses that. Register `app.getHttpAdapter().getInstance().addHook('onRequest', …)` for the token check; keep a `CanActivate` guard too so the check is visible in the controller's decorators and reusable for future routes. The 256 KB `bodyLimit` bounds exposure regardless. |
| Body validation         | (a) `ZodValidationPipe` on the `@Body()` param; (b) validate explicitly inside the service                                                          | **(a).** Idiomatic and keeps the controller declarative. The pipe throws a typed exception the global filter renders as the exact `{status:'invalid', errors: ParseError[]}` shape (mapping `issue.path.map(String)`, `issue.message`, `issue.code`) — asserted by the parity suite.                                                                                                             |
| Error normalization     | (a) global `ExceptionFilter`; (b) per-route try/catch                                                                                               | **(a).** One `@Catch()` filter maps `PayloadTooLargeException` → 413, the Zod pipe exception → 400 `invalid`, everything else → 500 `{status:'error', message}`. Mirrors today's single `setErrorHandler`.                                                                                                                                                                                       |
| `write-config.ts`       | rewrite vs move verbatim                                                                                                                            | **Move verbatim.** It is pure `node:fs/promises` logic with no framework coupling. Its spec moves with it. This is the lowest-risk part of the change and should not be touched.                                                                                                                                                                                                                 |
| Env handling            | `@nestjs/config` `ConfigModule` vs plain `process.env` in `main.ts`                                                                                 | **Plain `process.env`.** Parity only. `ConfigModule` (schema validation, `.env` files, `ConfigService` injection) is genuinely useful once there are many settings — add it in the feature proposal that first needs it, not here.                                                                                                                                                               |
| Build / packaging       | (a) `nest build` (tsc) → `dist/` + pruned `node_modules`; (b) `nest build --webpack` → near-single bundle; (c) esbuild as today                     | Try **(b)** first for the smallest image; fall back to **(a)** if the webpack config fights `reflect-metadata` / dynamic imports. **(c) is off the table** — NestJS's decorator metadata and dynamic module resolution do not survive `esbuild --bundle` cleanly. Record the measured image-size delta in the PR against the 25 MB budget.                                                       |
| Test runner             | keep **Vitest** (repo standard) vs switch `server/` to **Jest** (NestJS default)                                                                    | **Keep Vitest**, add `unplugin-swc` + `@swc/core` for `emitDecoratorMetadata`. A split test runner is a maintenance and mental-model cost. Switching to Jest is the documented fallback only if the SWC route is not workable in a short spike — and needs sign-off.                                                                                                                             |
| PR shape                | one PR vs a 2-PR chain                                                                                                                              | Prefer **one PR** (~150–250 lines). If review budget is tight, split: PR 1 = framework port + tests (rollback = revert `server/`), PR 2 = Dockerfile/`entrypoint.sh` artifact wiring (rollback = revert those two files).                                                                                                                                                                        |

## Data Flow

Unchanged from `config-write-api/design.md` — only the box labels change:

```text
configurator "Save to server"
  -> ConfigWriteService.save(config)                       [frontend, unchanged]
  -> POST /api/config   { body: config, header: X-Config-Token }
  -> nginx  proxy_pass /api/ -> http://127.0.0.1:3000       [unchanged]
  -> Fastify onRequest hook + ConfigTokenGuard
        |-- token mismatch --> 401  (body not read)
  -> ZodValidationPipe on @Body()
        |-- invalid --> HttpExceptionFilter --> 400 { status:'invalid', errors: ParseError[] }
  -> ConfigController.save()
       -> ConfigWriterService.write(config)
            -> omitBlankBackgroundImages -> js-yaml.dump
            -> writeConfigAtomically: copy target -> .bak; write .tmp; fsync; rename -> target
        |-- fs error --> HttpExceptionFilter --> 500 { status:'error', message }
        |-- ok        --> 200 { status:'saved' }
  -> ConfigWriteService maps result -> NotificationService  [frontend, unchanged]
```

Oversized bodies are rejected by the `FastifyAdapter` `bodyLimit` and surface through the filter as
`413 { status:'error', message }`, as today.

## File Changes

| File                                          | Action    | Description                                                                                                                                                          |
| --------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/main.ts`                          | New       | Replaces `index.ts`; env checks, Fastify adapter, `bodyLimit`, listen                                                                                                |
| `server/src/app.module.ts`                    | New       | `forRoot({ token, targetPath })`; declares controller + providers                                                                                                    |
| `server/src/config/config.controller.ts`      | New       | `@Post('api/config')`, `@UseGuards`, `@Body(ZodValidationPipe)`                                                                                                      |
| `server/src/config/config-token.guard.ts`     | New       | `CanActivate` token comparison                                                                                                                                       |
| `server/src/config/zod-validation.pipe.ts`    | New       | `DashboardConfigSchema.safeParse`; throws typed exception on failure                                                                                                 |
| `server/src/config/config-writer.service.ts`  | New       | `omitBlankBackgroundImages` → `dump` → `writeConfigAtomically`                                                                                                       |
| `server/src/common/http-exception.filter.ts`  | New       | `{status, ...}` normalization for 413 / 400 / 500                                                                                                                    |
| `server/src/config/write-config.ts`           | Moved     | Verbatim from `server/src/write-config.ts`                                                                                                                           |
| `server/src/app.ts`, `server/src/index.ts`    | Deleted   | Replaced by module + `main.ts`                                                                                                                                       |
| `server/src/app.spec.ts`                      | Rewritten | → `server/test/config.e2e-spec.ts`, same cases via `Test.createTestingModule()`                                                                                      |
| `server/src/write-config.spec.ts`             | Moved     | → `server/test/write-config.spec.ts`, assertions unchanged                                                                                                           |
| `server/package.json`                         | Modified  | Nest deps in, `fastify` direct dep out, `esbuild` maybe out, SWC dev dep in, scripts updated                                                                         |
| `server/tsconfig.json`                        | Modified  | `experimentalDecorators`, `emitDecoratorMetadata`; `nest-cli.json` added if using `nest build`                                                                       |
| `server/vitest.config.ts`                     | Modified  | `unplugin-swc` plugin for decorator metadata                                                                                                                         |
| `Dockerfile`                                  | Modified  | `server-builder`: `npm run build` (nest/webpack) then prune; production stage copies `dist/` + `node_modules` (path unchanged: `/app/server/…`, `/app/node_modules`) |
| `entrypoint.sh`                               | Modified  | `node /app/server/main.js` instead of `/app/server/index.mjs`                                                                                                        |
| `nginx.conf`                                  | Unchanged | —                                                                                                                                                                    |
| `.github/workflows/test.yml`                  | Unchanged | Existing `server` `npm ci` / typecheck / test steps still valid                                                                                                      |
| `ARCHITECTURE.md`                             | Modified  | "Config Write Sidecar" + "Stack" table (Fastify → NestJS)                                                                                                            |
| `CHANGELOG.md`                                | Modified  | Internal-change entry                                                                                                                                                |
| `openspec/changes/config-write-api/design.md` | Modified  | "HTTP framework" decision row marked superseded by this change                                                                                                       |

## Open Questions

- [ ] **Q1 — Roadmap gate.** Is optional-auth / multi-user / config-in-DB actually committed for a
      near-term release? If not, this proposal should be shelved rather than shipped. (Owner: product.)
- [ ] **Q2 — Image-size budget.** Is 25 MB compressed an acceptable ceiling for the growth, or is
      there a harder limit for the self-hosted image? Measured delta goes in the PR.
- [ ] **Q3 — Bundling.** Does `nest build --webpack` (or the SWC single-file builder) produce a
      working artifact given the cross-directory `dashboard.models.ts` import, or do we ship
      `dist/` + pruned `node_modules`? Resolve with a spike before estimating the Docker task.
- [ ] **Q4 — Vitest + decorators.** Does `unplugin-swc` give clean `emitDecoratorMetadata` for the
      `server/` suite within a 1–2 h spike? If not: switch `server/` to Jest (needs sign-off) or
      defer the migration.
- [ ] **Q5 — PR shape.** One PR, or the 2-PR chain (port, then Docker/CI)? Depends on reviewer
      preference and the measured diff size.
