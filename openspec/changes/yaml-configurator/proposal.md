# Proposal: Browser-based YAML Configurator

## Intent

Add an accessible UI for creating and editing dashboard configuration without hand-authoring YAML.
Deployments remain read-only; users export YAML for placement.

## Scope

### In Scope
- Lazy `/configure` feature with typed reactive forms for settings, categories, applications, and
  bookmarks.
- Explicit entry choice to load valid mounted YAML or start empty, plus local YAML file import.
- Shared validation for unique IDs, valid category references, and reserved virtual-category IDs.
- Canonical YAML generation with clipboard copy and `dashboard.yaml` download.
- Accessible collection editing and validation meeting WCAG AA and AXE checks.
- Documentation and example alignment with authoritative schema constraints.

### Out of Scope
- ~~Server-side writes or automatic deployment of generated YAML.~~ **Superseded by
  `config-write-api`** (2026-09-04): that change adds a "Save to server" action alongside the
  copy/download flow this proposal delivers. Copy/download remain unchanged and keep working
  without a server write.
- Preservation of YAML comments or original formatting.
- Draft autosave, local storage, and generic form generation.

## Capabilities

### New Capabilities
- `yaml-configurator`: Create, import, validate, edit, and export dashboard configuration.

### Modified Capabilities
- None.

## Approach

Add a lazy route and router-aware shell while retaining the dashboard at `/`. Keep incomplete drafts
separate from validated `DashboardConfig`. A shared codec uses the existing Zod parser for imports
and `js-yaml` for canonical serialization; export requires structural and semantic validation.
Preserve loader outcomes so mounted YAML states are distinguishable from the runtime fallback.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/app.routes.ts`, `src/app/app.*` | Modified | Route and application shell |
| `src/app/features/configurator/` | New | Forms, draft state, and accessible workflow |
| `src/app/core/models/dashboard.models.ts` | Modified | Shared semantic constraints |
| `src/app/core/services/yaml-*.service.ts` | Modified | Import, loader outcomes, export |
| `src/app/**/*.spec.ts` | Modified | Routing, validation, codec, and UI coverage |
| `README.md`, `config/`, `public/config/` | Modified | Guidance and examples |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stronger validation rejects accepted YAML | Medium | Provide migration errors and document constraints |
| Routing regresses dashboard startup | Medium | Test initialization and direct navigation |
| Nested editing harms accessibility | Medium | Stable focus, keyboard controls, and AXE tests |

## Rollback Plan

Remove the route and feature, restore direct root composition, and revert validation and codec/loader
changes. Existing dashboard loading remains the baseline.

## Dependencies

- Existing Angular Router, Reactive Forms, Zod schemas, and `js-yaml`; no new backend or library.

## Success Criteria

- [ ] Users can start empty, load mounted YAML, or import a local YAML file.
- [ ] Invalid IDs and category references block export with actionable errors.
- [ ] Valid drafts copy and download as normalized `dashboard.yaml` without server writes.
- [ ] Dashboard `/` behavior remains intact and configurator flows pass unit and AXE checks.
