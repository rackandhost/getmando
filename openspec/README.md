# OpenSpec

This directory holds the project's specifications. It follows the
[OpenSpec](https://github.com/Fission-AI/OpenSpec) `spec-driven` layout: every non-trivial change is
proposed, planned, and verified in writing before and while it is built, and the specs are the
shared source of truth for what the system does.

`config.yaml` holds the stack context and the per-phase rules (proposal, specs, design, tasks,
apply, verify, archive).

## Layout — and how to read the state of a piece of work

```
openspec/
  config.yaml                     stack context + phase rules
  specs/<capability>/spec.md       BUILT & CURRENT — the behaviour that ships today
  changes/<id>/                    ACTIVE — proposed or in progress
    proposal.md                    intent, scope, risks, rollback, success criteria
    design.md                      architecture decisions with rationale
    tasks.md / tasks/todo.md       the work breakdown (its checkboxes show progress)
    specs/<capability>/spec.md     the delta this change makes to a capability spec
  changes/archive/<YYYY-MM-DD>-<id>/   DONE & DEPLOYED — kept as the historical record
```

| Question                                         | Where to look                                                                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **What does the system do today?**               | `specs/` — one folder per capability                                                                                                           |
| **What might change / is being built?**          | `changes/<id>/` (excluding `archive/`)                                                                                                         |
| **Is a change proposed or already in progress?** | its `tasks.md`: absent or all-unchecked → proposed; partially checked → in progress; a `verify-report.md` present → finished, ready to archive |
| **How did we get here?**                         | `changes/archive/` — every shipped change, newest date last                                                                                    |

## Lifecycle

```
proposal.md                       →  changes/<id>/           (ACTIVE — future work)
  + design.md + tasks.md          →  changes/<id>/           (ACTIVE — in progress)
  implement + verify              →  changes/<id>/verify-report.md
  ship it                         →  promote the delta into specs/<capability>/spec.md
                                     move changes/<id>/ → changes/archive/<date>-<id>/
```

Archiving is done per change **when it ships**, dated by the day the work completed. Promoting a
change's delta spec into `specs/` is what turns "done" into "current truth"; the archived change
keeps its own copy as a point-in-time record.

## Built capabilities

The folders are the index — `ls specs/` for what's built, `ls changes/` for what's proposed or in
progress, `ls changes/archive/` for history. This table only adds the release each capability
shipped in, which the folders don't record; add a row when a spec is promoted into `specs/`.

| Capability          | Shipped in | Notes                                                         |
| ------------------- | ---------- | ------------------------------------------------------------- |
| `app-favorites`     | v1.0.0     | `favorite` flag + virtual Favorites category                  |
| `yaml-configurator` | v2.0.0     | `/configure` browser editor; first-run-without-YAML behaviour |
| `config-write-api`  | v2.0.0     | `POST /api/config` write sidecar; `:ro` → `:rw` volume change |
