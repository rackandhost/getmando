# Implementation Plan: YAML Configurator Completion

## Overview
Complete the browser-based YAML configurator so it satisfies `openspec/changes/yaml-configurator`: users can explicitly start empty, load valid mounted YAML, import a local YAML file, edit every schema-backed dashboard field, receive actionable validation feedback, and export normalized YAML without server writes. The current implementation has useful schema/codec/export foundations, but the UI and draft boundary are incomplete and one route verification path is red in jsdom.

## Architecture Decisions
- Keep the shared Zod schema as the only validated `DashboardConfig` boundary; introduce a separate `ConfiguratorDraft` model that can represent incomplete form values.
- Prefer focused, typed field-edit handlers over generic `any`/stringly form generation; this keeps Angular templates understandable and avoids over-generalized form abstractions.
- Render validation errors next to controls from a single field-error mapping shared by categories, applications, bookmarks, metadata, and settings.
- Fix the jsdom `matchMedia` test boundary in test setup or route spec providers rather than weakening route coverage.
- Preserve browser-only export behavior through existing `YamlCodecService` and `ConfigExportService`; no HTTP write API is introduced.

## Task List

### Phase 1: Verification and Draft Boundary
- [x] Task 1: Stabilize route/configurator test verification
- [x] Task 2: Split incomplete configurator draft from validated dashboard config

### Checkpoint: Foundation
- [x] Focused tests for routes, store, schema, codec, and export pass
- [x] `npx tsc --noEmit -p tsconfig.spec.json` passes

### Phase 2: Entry and Import Flow
- [x] Task 3: Add explicit start/load/import entry workflow

### Checkpoint: Entry Flow
- [x] Users can start empty, load mounted YAML, and import local YAML through accessible controls
- [x] No browser persistence or server writes are introduced

### Phase 3: Complete Editing Surface
- [x] Task 4: Complete metadata and settings editing
- [x] Task 5: Complete application editing
- [x] Task 6: Complete bookmark editing

### Checkpoint: Editing Surface
- [x] Every exported schema field has an accessible editor control
- [x] Focused configurator page/editor tests pass
- [x] Manual `/configure` smoke check verifies the full edit path

### Phase 4: Validation UX and Final Alignment
- [x] Task 7: Make validation errors actionable for all editable fields
- [x] Task 8: Final regression, documentation alignment, and review handoff

### Checkpoint: Complete
- [x] `npx ng test --watch=false` passes or remaining failures are explicitly unrelated and documented with evidence
- [x] `npx tsc --noEmit -p tsconfig.spec.json` passes
- [x] README/examples match the implemented schema and canonical export behavior
- [x] Ready for review

## Dependency Graph

```text
Test environment stability
    └── Draft type boundary
            ├── Entry/import workflow
            ├── Metadata/settings editors
            ├── Application editor
            └── Bookmark editor
                    └── Universal validation UX
                            └── Final docs/regression
```

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Editing every schema field makes one component too large | High | Keep the generic collection shell, but extract small field groups only when a group earns its complexity. |
| Draft model drifts from the Zod schema | Medium | Add tests that convert draft to schema input and validate/export representative complete configs. |
| Validation paths do not map to rendered controls | High | Add table-driven tests for metadata, settings, category, application, and bookmark error links. |
| jsdom browser API gaps hide route regressions | Medium | Provide `matchMedia` test shim or mocked providers and keep direct route harness coverage. |
| Large remediation becomes hard to review | Medium | Land in task order; each task should touch ~5 files or fewer and keep focused tests green. |

## Open Questions
- None. Decision confirmed: every schema-backed field must be editable in this iteration.
