# Design: Browser-based YAML Configurator

## Technical Approach

Route the dashboard at `/` and lazy-load `/configure`. Typed reactive forms hold incomplete values;
only the shared Zod boundary produces `DashboardConfig`. Record the startup request outcome so the
configurator offers “load existing” versus “start empty” without refetching. Valid output is
serialized, copied, or downloaded in-browser.

## Architecture Decisions

| Decision | Options and tradeoff | Choice and rationale |
|---|---|---|
| Shell and loading | Direct composition prevents lazy routing | Route dashboard at `/`; lazy-load the feature to preserve its URL and isolate its code. |
| Draft boundary | Defaults as config versus incomplete model | Use typed non-nullable forms in a feature store. Values remain drafts until schema parsing succeeds. |
| Mounted YAML | Refetch versus retain startup outcome | Retain `valid`, `missing`, `invalid`, or `unavailable`. This avoids duplicate HTTP and notifications; only `valid` triggers the choice. |
| Validation | UI-only versus shared semantics | Add Zod `superRefine` checks for unique IDs, category references, and reserved `apps`, `bookmarks`, `favorites`. Map issue paths to controls and an error summary. |
| YAML output | Preserve text versus normalize | Build an ordered object and use fixed `js-yaml.dump` options. Comments, unknown keys, and formatting are discarded. |
| Collection UX | Drag-and-drop versus controls | Use labeled add/remove/move buttons; focus the added item or nearest survivor after mutation. |

## Data Flow

```text
bootstrap -> YamlLoaderService -> mounted outcome + dashboard fallback
                                      |
/configure -> entry choice/import -> YamlCodecService.parse -> ConfiguratorStore form
                                                        |
form submit -> DashboardConfigSchema -> canonical YAML -> clipboard / dashboard.yaml
```

The page confirms navigation only while dirty; no draft is persisted. Export failures go through
`LoggerService` and one `NotificationService` notification.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/app/app.routes.ts` | Modify | Add eager `/` dashboard and lazy `/configure` routes. |
| `src/app/app.ts`, `src/app/app.html` | Modify | Replace direct dashboard composition with `RouterOutlet`; retain global toast. |
| `src/app/core/models/dashboard.models.ts` | Modify | Add reserved-ID constants and shared semantic refinements. |
| `src/app/core/services/yaml-loader.service.ts` | Modify | Preserve the startup outcome without changing fallback ownership. |
| `src/app/core/services/yaml-codec.service.ts` | Create | Parse through the shared schema and serialize canonical YAML. |
| `src/app/core/services/config-export.service.ts` | Create | Encapsulate Clipboard and Blob/download browser effects. |
| `src/app/features/configurator/configurator.routes.ts` | Create | Lazy feature route. |
| `src/app/features/configurator/configurator.store.ts` | Create | Feature-scoped form, state, mutations, validation, and export. |
| `src/app/features/configurator/configurator-page.component.*` | Create | Accessible workflow shell and error summary. |
| `src/app/features/configurator/components/**` | Create | Focused entry, settings, category, application, bookmark, and export controls. |
| `src/app/**/*.spec.ts` | Modify/Create | Strict-TDD coverage for every boundary and interaction. |
| `README.md`, `config/dashboard.example.yaml`, `public/config/dashboard.example.yaml` | Modify | Align documented constraints and canonical examples. |

## Interfaces / Contracts

```ts
type MountedConfigResult =
  | { status: 'valid'; config: DashboardConfig }
  | { status: 'missing' }
  | { status: 'invalid'; errors: ParseError[] }
  | { status: 'unavailable'; message: string };

type ConfigValidationResult =
  | { success: true; config: DashboardConfig }
  | { success: false; errors: ParseError[] };
```

The store exposes readonly signals and intent methods. Components use `input()`, `output()`, OnPush,
native control flow, and no NgModules.

## Testing Strategy

Strict TDD uses `ng test`: write each failing test before production code.

| Layer | What to test | Approach |
|---|---|---|
| Unit | Semantics and deterministic parse/dump | Vitest tables for duplicate/reserved IDs, dangling categories, and round trips. |
| Integration | Outcomes, routes, entry/import, editing, focus, export and failures | Angular Testing Library with mocked boundaries, AXE, and keyboard interactions. |
| E2E | N/A | No E2E harness is available; route and browser boundaries are integration-tested in jsdom. |

## Threat Matrix

The change includes browser routing, so route authorization and direct navigation receive RED
integration tests. The reference matrix's execution boundaries are otherwise inapplicable:

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | N/A — no executable classification | Files are read only as user-selected text | None |
| Git repository selection | N/A — no VCS integration | No repository access | None |
| Commit state | N/A — no VCS integration | No index/worktree access | None |
| Push state | N/A — no VCS integration | No remote operations | None |
| PR commands | N/A — no PR automation | No command composition | None |

## Migration / Rollout

No data migration or feature flag is required. Stronger semantic validation may reject ambiguous
existing YAML; import errors and README guidance provide the migration path. Rollback removes the
route/feature and semantic refinements while restoring direct dashboard composition.

## Open Questions

None.
