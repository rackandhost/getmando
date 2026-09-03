## Exploration: Browser-based YAML configurator

### Current State
Mando is a client-only Angular 21 dashboard with no write-capable backend. Startup always fetches
`/config/dashboard.yaml`, parses it with `js-yaml`, validates it with the Zod schemas in
`dashboard.models.ts`, and installs either the validated configuration or an in-memory fallback.
The root currently renders the dashboard directly even though Angular Router is provided; the route
table is empty.

The existing runtime types already cover metadata, categories, applications, bookmarks, icons, and
display/search settings, and `js-yaml` can also serialize those typed values. However, parsing YAML
normalizes it: comments and original formatting are lost, defaults are inserted, and unknown keys are
stripped by the current Zod objects. There is no serializer abstraction or browser form state today.

Two schema details matter for an empty-start workflow. Valid YAML requires at least one category and
one application, while `DEFAULT_DASHBOARD_CONFIG` intentionally contains no applications and is
therefore useful as a draft but is not valid output. The schema also validates field shapes but does
not enforce unique IDs, valid application-to-category references, or collisions with virtual category
IDs. Documentation currently disagrees with the schema on the `itemsPerRow` maximum (12 versus 10)
and one light-background default.

### Affected Areas
- `src/app/app.routes.ts` — currently empty; a lazy configurator route can be added without replacing the dashboard URL.
- `src/app/app.ts` and `src/app/app.html` — root composition currently bypasses the router and would need a router outlet or equivalent shell decision.
- `src/app/core/models/dashboard.models.ts` — authoritative configuration types, defaults, and validation constraints.
- `src/app/core/services/yaml-parser.service.ts` — reusable import validation boundary; serialization should sit beside, not inside, UI components.
- `src/app/core/services/yaml-loader.service.ts` — already knows the same-origin mounted YAML location but currently converts failures to defaults, which hides “file absent” from a configurator entry flow.
- `src/app/core/initializers/dashboard.initializer.ts` — loads configuration before any route renders; the configurator should not depend on this fallback as evidence that valid YAML exists.
- `src/app/core/services/yaml-parser.service.spec.ts` — existing parser/default behavior is the baseline for import and generation tests.
- `config/dashboard.example.yaml`, `public/config/dashboard.example.yaml`, and `README.md` — user-facing examples and constraints must match generated canonical YAML.
- `nginx.conf` and `Dockerfile` — confirm the browser can read but cannot persist the mounted YAML; generated output must be copied or downloaded for the user to place manually.

### Approaches
1. **Explicit typed configurator feature** — Add a lazy `/configure` feature whose small, section-focused reactive forms edit signal-backed `DashboardConfig` draft state, with shared import/validation/serialization services.
   - Pros: Accessible controls can explain constraints; compile-time types track the schema; category/application relationships can be managed visually; tests can cover each responsibility; no backend is required.
   - Cons: More UI code; schema additions require corresponding form work; root routing and startup-loading behavior need deliberate separation.
   - Effort: High

2. **Schema-driven generic form renderer** — Derive fields and validation from metadata layered around the Zod schema.
   - Pros: Less repetitive when scalar fields are added; a single metadata model can drive labels and constraints.
   - Cons: Zod does not contain sufficient UX metadata; nested reorderable collections and cross-field category references still need custom controls; generic rendering increases accessibility and maintenance risk.
   - Effort: High

3. **YAML editor with structured preview** — Present editable YAML text, validate it with the existing parser, and preview the dashboard.
   - Pros: Smallest change and preserves YAML as the primary representation.
   - Cons: Does not satisfy the goal of replacing manual YAML authoring; remains error-prone and offers weak guidance for non-technical users.
   - Effort: Medium

### Recommendation
Use the explicit typed configurator feature. Keep the current dashboard at `/`, lazy-load the
configurator at `/configure`, and introduce one configuration codec boundary that imports through the
existing parser and serializes a validated `DashboardConfig` with `js-yaml`. The configurator should
hold incomplete drafts separately from `DashboardConfig`; generation remains disabled until the
shared validation contract passes. Offer both copy-to-clipboard and `.yaml` download, because the
static nginx deployment cannot write the mounted file.

Before proposal, confirm these bounded product decisions:

| Decision | Recommended default | Consequence |
|---|---|---|
| Valid mounted YAML on configurator entry | Show one explicit choice: load existing or start empty | Meets the request without silently discarding or importing configuration. |
| Local YAML import | Include file upload in the first release | Supports users configuring a file that is not currently mounted at `/config/dashboard.yaml`. |
| Round-trip fidelity | Generate normalized canonical YAML; do not promise comment or formatting preservation | Reuses current parse/validation behavior and avoids building an AST-preserving YAML editor. |
| Semantic constraints | Add shared uniqueness, category-reference, and reserved-ID validation | Prevents the UI from generating structurally valid but behaviorally ambiguous configuration; may reject YAML accepted today. |
| Generated output | Provide clipboard copy and `dashboard.yaml` download only | Preserves the backend-free architecture and makes it explicit that the user performs deployment. |
| Draft persistence | Exclude autosave/local storage from the first release | Avoids privacy and stale-draft decisions; navigation-away protection can still prevent accidental loss. |

### Risks
- Strengthening shared validation can reject previously accepted files, so compatibility behavior needs an explicit decision and migration message.
- Root routing changes can regress existing direct dashboard rendering and startup tests if the shell boundary is not introduced carefully.
- `YamlLoaderService` currently maps missing, unreadable, and invalid YAML to the same default result; entry detection needs a raw/read result that preserves those states and avoids duplicate user notifications.
- Imported YAML cannot preserve comments or exact formatting with the current `js-yaml` plus Zod pipeline.
- Accessible nested collection editing requires stable focus after add, remove, and reorder operations, descriptive errors, and keyboard-operable controls to satisfy AXE and WCAG AA.
- The example files and README contain schema drift; leaving them unchanged would make the UI, validation, and documentation disagree.

### Ready for Proposal
No. The implementation direction is clear, but the orchestrator should obtain explicit confirmation
of the six bounded product decisions above. After confirmation, proposal can proceed; optional
source-backed research is unlikely to change the core architecture unless the team wants to evaluate
an AST-preserving YAML library or a drag-and-drop accessibility pattern.
