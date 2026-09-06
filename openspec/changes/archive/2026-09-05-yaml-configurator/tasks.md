# Tasks: Browser-based YAML Configurator

## Review Workload Forecast

| Field                   | Value                     |
| ----------------------- | ------------------------- |
| Estimated changed lines | 900–1,300                 |
| 400-line budget risk    | High                      |
| Chained PRs recommended | Yes                       |
| Suggested split         | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy       | ask-on-risk               |
| Chain strategy          | pending                   |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                                                              | Likely PR | Focused test command | Runtime harness                                                          | Rollback boundary                                                                                       |
| ---- | --------------------------------------------------------------------------------- | --------- | -------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 1    | Shared semantic validation, mounted outcome, codec, and browser export boundaries | PR 1      | `ng test`            | N/A — no E2E harness; jsdom boundary tests                               | Revert models and `src/app/core/services/yaml-*.service.ts`, `config-export.service.ts` and their tests |
| 2    | Lazy routing, shell, typed draft store, and entry/import workflow                 | PR 2      | `ng test`            | N/A — Angular Testing Library covers direct navigation and mocked loader | Revert route, shell, store, and entry workflow files                                                    |
| 3    | Accessible settings and collection editors with keyboard/focus behavior           | PR 3      | `ng test`            | N/A — jsdom keyboard integration is the available browser harness        | Revert configurator component files and interaction tests                                               |
| 4    | Export integration, documentation, examples, and full regression coverage         | PR 4      | `ng test`            | N/A — no E2E harness; integration tests prove copy/download              | Revert docs/examples and integration-only changes                                                       |

## Phase 1: Domain and Browser Boundaries

- [x] 1.1 RED: add schema tests for duplicate IDs, dangling category references, reserved virtual IDs, and valid configurations in `src/app/core/models/dashboard.models.spec.ts`.
- [x] 1.2 GREEN: add reserved-ID constants and Zod `superRefine` semantic checks in `src/app/core/models/dashboard.models.ts`; REFACTOR shared issue-path mapping without changing behavior.
- [x] 1.3 RED/GREEN/REFACTOR: test and implement retained `MountedConfigResult` outcomes in `src/app/core/services/yaml-loader.service.spec.ts` and `yaml-loader.service.ts`.
- [x] 1.4 RED/GREEN/REFACTOR: test schema parsing plus deterministic ordered `js-yaml` dump in `yaml-codec.service.spec.ts` and create `yaml-codec.service.ts`.
- [x] 1.5 RED/GREEN/REFACTOR: test clipboard success/failure and `dashboard.yaml` Blob download in `config-export.service.spec.ts`; create `config-export.service.ts`.

## Phase 2: Routing and Draft Workflow

- [x] 2.1 RED: add direct `/configure` navigation, root dashboard regression, and route-boundary tests in `src/app/app.routes.spec.ts` (threat-matrix direct-navigation case).
- [x] 2.2 GREEN: add lazy configurator routes and `RouterOutlet` shell in `src/app/app.routes.ts`, `src/app/app.ts`, and `src/app/app.html`; REFACTOR route providers.
- [x] 2.3 RED/GREEN/REFACTOR: test and implement typed signal-backed draft state, mounted choice, local import, validation, and dirty/no-persistence behavior in `configurator.store.spec.ts` and `configurator.store.ts`.

## Phase 3: Accessible Editing

- [x] 3.1 RED/GREEN/REFACTOR: test and build page entry, settings, field errors, and associated summary in `configurator-page.component.*` and focused component files.
- [x] 3.2 RED/GREEN/REFACTOR: test labeled add/remove/move controls, intentional focus, and keyboard editing for categories, applications, and bookmarks under `features/configurator/components/**` (threat-matrix route authorization/direct access remains covered by 2.1).
- [x] 3.3 Corrective RED/GREEN/REFACTOR: restore dashboard visual parity for the page entry and collection editor using established Tailwind surfaces, responsive layout, form controls, empty states, validation treatment, and visible focus/hover/disabled states; preserve Phase 3 accessibility contracts.
- [x] 3.4 Corrective RED/GREEN/REFACTOR: integrate the configurator with the dashboard visual system by reusing the shared header, footer, active branded background, translucent surfaces, and responsive composition; preserve Phase 3 accessibility contracts.
- [x] 3.5 Corrective RED/GREEN/REFACTOR: restore deliberate spacing between Categories, Applications, and Bookmarks with block-level collection hosts, and add schema-backed, accessible application `IconConfig` entry that persists through the typed draft and deterministic YAML export; preserve Phase 3 accessibility contracts.
- [x] 3.6 Corrective RED/GREEN/REFACTOR: preserve keyboard focus while editing category, application, and bookmark IDs; replace free-text application category assignment with an accessible category selector backed by the current draft; render move-up/move-down controls as icon-only buttons with accessible names and visible tooltips using the established icon library; and align add-category, add-application, and add-bookmark controls with the existing dashboard visual language. Preserve all Phase 3 accessibility contracts.
- [x] 3.7 Corrective RED/GREEN/REFACTOR: expose an accessible bookmark URL input backed by the typed draft; generate a safe lowercase kebab-case ID from every category, application, and bookmark name on every name change (removing unsupported characters and replacing whitespace with hyphens); preserve direct ID editing until a subsequent name change regenerates it; preserve Phase 3 accessibility contracts.

## Phase 4: Integration and Alignment

- [x] 4.1 RED/GREEN/REFACTOR: test export gating, copy/download notifications, and no-server-write behavior through page integration specs.
- [x] 4.2 Update `README.md`, `config/dashboard.example.yaml`, and `public/config/dashboard.example.yaml` with semantic constraints and normalized output guidance; run the complete `ng test` regression suite.
