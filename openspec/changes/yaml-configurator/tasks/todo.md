# YAML Configurator Completion Tasks

## Task 1: Stabilize route/configurator test verification

**Description:** Fix the red `/configure` route verification caused by missing `window.matchMedia` in jsdom while preserving direct-navigation coverage.

**Acceptance criteria:**
- [x] `src/app/app.routes.spec.ts` direct `/configure` navigation passes in jsdom.
- [x] The fix does not skip, delete, or weaken route assertions.
- [x] The chosen browser API shim/provider pattern is reusable and localized.

**Verification:**
- [x] Tests pass: `npx ng test --watch=false --no-coverage --include='src/app/app.routes.spec.ts'`
- [x] Build succeeds: `npx tsc --noEmit -p tsconfig.spec.json`

**Dependencies:** None

**Files likely touched:**
- `src/app/app.routes.spec.ts` or `test-setup.ts`
- Possibly `src/app/core/services/theme.service.spec.ts`

**Estimated scope:** Small: 1-2 files

## Task 2: Split incomplete configurator draft from validated dashboard config

**Description:** Replace `ConfiguratorDraft = DashboardConfig` with a draft type that can hold incomplete UI values, then validate/convert through the shared schema only at import/export validation boundaries.

**Acceptance criteria:**
- [x] Empty drafts are represented without pretending to be a valid `DashboardConfig`.
- [x] Valid mounted/imported configs clone into draft state without mutation.
- [x] Export validation still produces `DashboardConfig` through `DashboardConfigSchema`.

**Verification:**
- [x] Tests pass: `npx ng test --watch=false --no-coverage --include='src/app/features/configurator/configurator.store.spec.ts' --include='src/app/core/models/dashboard.models.spec.ts' --include='src/app/core/services/yaml-codec.service.spec.ts'`
- [x] Build succeeds: `npx tsc --noEmit -p tsconfig.spec.json`

**Dependencies:** Task 1

**Files likely touched:**
- `src/app/features/configurator/configurator.store.ts`
- `src/app/features/configurator/configurator.store.spec.ts`
- `src/app/core/models/dashboard.models.ts`
- `src/app/core/models/dashboard.models.spec.ts`

**Estimated scope:** Medium: 3-5 files

## Checkpoint: Foundation
- [x] Focused route/store/schema/codec tests pass.
- [x] `npx tsc --noEmit -p tsconfig.spec.json` passes.
- [x] No suppressions, skipped tests, or weakened assertions were introduced.

## Task 3: Add explicit start/load/import entry workflow

**Description:** Add the spec-required entry controls so users can start empty, load the retained valid mounted YAML, or import a local YAML file from disk.

**Acceptance criteria:**
- [x] The page exposes accessible controls for “Start empty”, “Load mounted YAML”, and local YAML import.
- [x] Load mounted is available only when `canLoadMountedConfig()` is true and does not refetch YAML.
- [x] Invalid local imports preserve the current draft and show validation errors.

**Verification:**
- [x] Tests pass: `npx ng test --watch=false --no-coverage --include='src/app/features/configurator/configurator-page.component.spec.ts' --include='src/app/features/configurator/configurator.store.spec.ts'`
- [x] Build succeeds: `npx tsc --noEmit -p tsconfig.spec.json`
- [x] Manual check: open `/configure`, exercise all three entry paths with mocked/real YAML.

**Dependencies:** Task 2

**Files likely touched:**
- `src/app/features/configurator/configurator-page.component.ts`
- `src/app/features/configurator/configurator-page.component.html`
- `src/app/features/configurator/configurator-page.component.spec.ts`
- `src/app/features/configurator/configurator.store.spec.ts`

**Estimated scope:** Medium: 3-5 files

## Checkpoint: Entry Flow
- [x] Start/load/import workflow works from the UI.
- [x] No localStorage/sessionStorage draft persistence is introduced.
- [x] No server write or upload request is introduced.

## Task 4: Complete metadata and settings editing

**Description:** Add accessible controls for every schema-backed metadata and settings field, including description, date display settings, layout count, bookmark/category/display flags, search engines, and background image paths.

**Acceptance criteria:**
- [x] All `metadata` fields are editable.
- [x] All `settings` fields in `DashboardSettingsSchema` are editable with appropriate control types.
- [x] Settings changes update draft state immediately or on intentional commit consistently.

**Verification:**
- [x] Tests pass: `npx ng test --watch=false --no-coverage --include='src/app/features/configurator/configurator-page.component.spec.ts' --include='src/app/features/configurator/configurator.store.spec.ts'`
- [x] Build succeeds: `npx tsc --noEmit -p tsconfig.spec.json`
- [x] Manual check: edit settings, export YAML, confirm changed values appear canonically.

**Dependencies:** Task 3

**Files likely touched:**
- `src/app/features/configurator/configurator-page.component.ts`
- `src/app/features/configurator/configurator-page.component.html`
- `src/app/features/configurator/configurator-page.component.spec.ts`
- `src/app/features/configurator/configurator.store.ts`

**Estimated scope:** Medium: 3-5 files

## Task 5: Complete application editing

**Description:** Extend the application editor so users can edit all application fields: URL, description, `openNewTab`, tags, favorite, category, icon, ID, and name.

**Acceptance criteria:**
- [x] Application URL and description fields are rendered, labeled, and draft-backed.
- [x] `openNewTab` and `favorite` are editable via accessible boolean controls.
- [x] Tags can be edited in a clear format and serialize to the expected string array.

**Verification:**
- [x] Tests pass: `npx ng test --watch=false --no-coverage --include='src/app/features/configurator/components/collection-editor.component.spec.ts' --include='src/app/features/configurator/configurator-page.component.spec.ts'`
- [x] Build succeeds: `npx tsc --noEmit -p tsconfig.spec.json`
- [x] Manual check: create an application from empty draft, fill fields, validate/export.

**Dependencies:** Task 4

**Files likely touched:**
- `src/app/features/configurator/components/collection-editor.component.ts`
- `src/app/features/configurator/components/collection-editor.component.html`
- `src/app/features/configurator/components/collection-editor.component.spec.ts`
- `src/app/features/configurator/configurator-page.component.ts`
- `src/app/features/configurator/configurator.store.ts`

**Estimated scope:** Medium: 3-5 files

## Task 6: Complete bookmark editing

**Description:** Extend the bookmark editor so users can edit all bookmark fields: URL, description, icon, `openNewTab`, tags, ID, and name.

**Acceptance criteria:**
- [x] Bookmark description, icon type/value, `openNewTab`, and tags are editable.
- [x] Bookmark edits preserve typed draft values and export as canonical YAML.
- [x] Bookmark controls match application accessibility patterns.

**Verification:**
- [x] Tests pass: `npx ng test --watch=false --no-coverage --include='src/app/features/configurator/components/collection-editor.component.spec.ts' --include='src/app/features/configurator/configurator-page.component.spec.ts'`
- [x] Build succeeds: `npx tsc --noEmit -p tsconfig.spec.json`
- [x] Manual check: create a bookmark from empty draft, fill fields, validate/export.

**Dependencies:** Task 5

**Files likely touched:**
- `src/app/features/configurator/components/collection-editor.component.ts`
- `src/app/features/configurator/components/collection-editor.component.html`
- `src/app/features/configurator/components/collection-editor.component.spec.ts`
- `src/app/features/configurator/configurator-page.component.ts`
- `src/app/features/configurator/configurator.store.ts`

**Estimated scope:** Medium: 3-5 files

## Checkpoint: Editing Surface
- [x] Every schema-exported field is editable from `/configure`.
- [x] AXE-focused page test still passes.
- [x] Manual copy/download includes edited metadata, settings, applications, and bookmarks.

## Task 7: Make validation errors actionable for all editable fields

**Description:** Replace special-case error rendering with generic field-level validation presentation across metadata, settings, categories, applications, and bookmarks.

**Acceptance criteria:**
- [x] Every validation summary link targets an existing focusable field or a meaningful collection section.
- [x] Every invalid editable field receives `aria-invalid` and an existing `aria-describedby` error element.
- [x] Bookmarks receive the same error mapping coverage as categories/applications.

**Verification:**
- [x] Tests pass: `npx ng test --watch=false --no-coverage --include='src/app/features/configurator/configurator-page.component.spec.ts' --include='src/app/features/configurator/components/collection-editor.component.spec.ts'`
- [x] Build succeeds: `npx tsc --noEmit -p tsconfig.spec.json`
- [x] Manual check: trigger invalid URLs, duplicate IDs, reserved IDs, and dangling categories; verify links/focus/errors.

**Dependencies:** Tasks 4-6

**Files likely touched:**
- `src/app/features/configurator/configurator-page.component.ts`
- `src/app/features/configurator/configurator-page.component.html`
- `src/app/features/configurator/components/collection-editor.component.ts`
- `src/app/features/configurator/components/collection-editor.component.html`
- `src/app/features/configurator/components/collection-editor.component.spec.ts`

**Estimated scope:** Medium: 3-5 files

## Task 8: Final regression, documentation alignment, and review handoff

**Description:** Run the complete verification story, align README/examples with the final UI behavior, and prepare the change for a second review.

**Acceptance criteria:**
- [x] README describes all configurator entry, editing, validation, and export behaviors accurately.
- [x] `config/dashboard.example.yaml` and `public/config/dashboard.example.yaml` satisfy the shared schema and semantic constraints.
- [x] Known unrelated failures, if any, are documented with reproducible evidence and not caused by this spec.

**Verification:**
- [x] Tests pass: `npx ng test --watch=false`
- [x] Build succeeds: `npx tsc --noEmit -p tsconfig.spec.json`
- [x] Formatting passes: project formatting command or focused `npx prettier --check` for changed files
- [x] Manual check: browser `/` dashboard still works and `/configure` supports full create/import/export flow.

**Dependencies:** Task 7

**Files likely touched:**
- `README.md`
- `config/dashboard.example.yaml`
- `public/config/dashboard.example.yaml`
- `openspec/changes/yaml-configurator/apply-progress.md`

**Estimated scope:** Small: 1-2 production/doc areas

## Checkpoint: Complete
- [x] Full suite and typecheck are green or unrelated failures are proven and documented.
- [x] Review findings from the previous review are resolved.
- [x] Human approves proceeding to implementation handoff/merge review.
