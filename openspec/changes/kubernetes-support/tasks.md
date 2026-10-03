# Tasks: Kubernetes Support

## Review Workload Forecast

| Field                   | Value               |
| ----------------------- | ------------------- |
| Estimated changed lines | 450–550             |
| 400-line budget risk    | Medium              |
| Chained PRs recommended | Optional            |
| Suggested split         | PR 1 → PR 2         |
| Delivery strategy       | ask-on-risk         |
| Chain strategy          | n/a (no shared branch) |

Decision needed before apply: No — all open questions were resolved in the design pass (and
OpenShift was descoped in change review); every decision is recorded in `design.md` § Architecture
Decisions and § Decisions.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
| ---- | ---- | --------- | -------------------- | ---------------- | ----------------- |
| 1 | Smoke-test harness + Kustomize base + CI step | PR 1 | `npm run verify:k8s` (local kind) + CI manifest step | kind cluster, real image | Delete `deploy/kubernetes/`, `scripts/verify-k8s.mjs`, the CI step, the npm script |
| 2 | Documentation (README section, ARCHITECTURE shape) + review pass | PR 2 (or same PR) | manual read-through | n/a | Revert README/ARCHITECTURE sections |

Strict-TDD note: this change has no unit-testable code — the smoke-test script **is** the RED/GREEN
harness (see `design.md` § Testing Strategy). Phase 1 writes it failing; each later phase's exit
check names the smoke assertion it turns green.

## Verification Environment

The primary development machine for this change has no container runtime, and the branch stays
local until the work is complete. Verification is therefore split, and the script's stage-scoped
prerequisite checking (see `design.md` § Interfaces / Contracts) is what makes the split safe:

- **Structural validation** (kustomize build, kubeconform) runs on the development machine during
  each phase. It needs only a standalone `kubectl` binary — no container runtime, no cluster; a
  binary on a local path is acceptable, no system-wide install required.
- **Runtime verification** (the kind smoke test) cannot run on that machine. The script detects
  the missing tooling per stage, prints a skip message, and exits 0 — a machine without `kind`
  never produces a false failure.
- Tasks and exit checks tagged **[held: runtime]** depend on the kind smoke test. They are
  completed in batch once the branch is pushed: a team member with the required container tooling
  (`kind`, `kubectl`, a container runtime) runs `npm run verify:k8s` against the pushed branch and
  records the outcome in this change's `verify-report.md` (task 5.2). Everything not tagged
  proceeds and completes locally.

Known pre-existing, environment-only conditions on the Windows development machine — neither
caused by this change nor covered by the `kubernetes-deployment` spec:

- `npm run format:check` reports the whole `src/**` tree because git checks out CRLF
  (`core.autocrlf=true`) while Prettier expects LF. CI on Linux sees LF and passes.
- `scripts/check-focused-tests.mjs` had two Windows-only portability bugs that made `npm test`
  fail 4 tests there (the guard `import.meta.url === \`file://${process.argv[1]}\`` never matched,
  so `main()` never ran; and `path.relative` reported `\`-separated paths the CLI spec asserts as
  POSIX). Both were fixed during this change, at the maintainer's request, as an incidental fix
  unrelated to Kubernetes support: the guard now uses `pathToFileURL`, and reported paths are
  normalized to POSIX separators. `npm test` is now 306/306 on both Windows and Linux.

## Phase 0: Resolve Open Questions — RESOLVED (design pass + change review)

- [x] 0.1 PVC vs ConfigMap for `dashboard.yaml`.
      → PVC. A ConfigMap mount is read-only and silently breaks the configurator's Save — the
      flagship capability. Recorded in `design.md` § Architecture Decisions.
- [x] 0.2 Helm vs plain manifests + Kustomize.
      → Kustomize. Fixed-shape single workload; Flux/Argo CD consume it natively; no values-matrix
      to maintain. Helm recorded as a follow-up. Recorded in `design.md` § Architecture Decisions.
- [x] 0.3 OpenShift/OKD support.
      → Descoped in change review: enterprise-oriented, negligible homelab audience, and the only
      distro requiring extra artifacts (Route overlay, SCC documentation, CI special-casing,
      manual OKD verification). The base manifests still apply there if the operator grants the
      `anyuid` SCC themselves — unsupported and undocumented. Recorded in `proposal.md` § Out of
      Scope and `design.md` § Decisions.
- [x] 0.4 Probe endpoint.
      → `/health` for liveness and readiness (same signal as the Docker HEALTHCHECK). Readiness on
      `/api/status` deferred until the `app-status-indicator` change ships — no dependency on an
      unshipped route.
- [x] 0.5 Replicas and update strategy under an RWO volume.
      → `replicas: 1` + `strategy: Recreate`; no autoscaler. RollingUpdate deadlocks on RWO.
- [x] 0.6 Write token plumbing.
      → Optional `secretKeyRef` (`optional: true`); no Secret resource in the kustomization; no
      committed token. Absent Secret = read-only deployment (mirrors the Docker `:ro` story).
- [x] 0.7 PVC StorageClass.
      → Omit `storageClassName` (cluster default); Talos no-default case is a README-documented
      one-line patch. 64Mi, RWO.
- [x] 0.8 CI validation depth.
      → `kubectl kustomize` + kubeconform (`-strict`, nothing skipped — no custom resources exist);
      no kind-in-CI for v1. The kind smoke test stays local/on-demand via `npm run verify:k8s`.
- [x] 0.9 Implementation parameters confirmed in change review (all nine, recorded verbatim):
      optional Secret (read-only deployment without it); Ingress shipped in the base and
      thoroughly documented; probes on `/health` for both liveness and readiness; PVC 64Mi RWO;
      resources 50m/64Mi → 256Mi; image pinned **by digest** (release tag as a comment, the
      release process owns each bump); CI structural-only for v1; `getmando` names/labels as the
      stable contract; kind smoke-test harness kept as the RED/GREEN translation of strict TDD.

## Phase 1: Smoke-Test Harness (RED)

- [x] 1.1 Write `scripts/verify-k8s.mjs` implementing the contract in `design.md` § Interfaces /
      Contracts, with stage-scoped prerequisite detection (the structural stage requires only
      `kubectl`; the runtime stages additionally require `kind` and a container runtime; a missing
      prerequisite skips that stage with a zero exit code while any runnable stage still runs),
      kind cluster create/teardown (fixed name, torn down on exit even on failure),
      `kubectl apply -k`, rollout wait, and the full assertion sequence (bundle, `/health`,
      `/config/dashboard.yaml`, Secret creation + rollout restart, `POST /api/config` round-trip,
      pod deletion + persistence re-check).
      - Acceptance: the script is complete and coherent; with a standalone `kubectl` available it
        fails at the structural build check because `deploy/kubernetes/` does not exist — this
        failure is the RED state and is expected. On the development machine it also demonstrates
        its skip behavior: the runtime stage reports `skipped: kind` and the run still exits 0.
      - Verify: `npm run verify:k8s` — RED confirmed via the build-check failure (structural),
        skip path confirmed for the runtime stage. **[held: runtime]** the full pass.
      - Files: `scripts/verify-k8s.mjs`, `package.json` (`verify:k8s` script).
      - Note: follows the conventions of the existing `scripts/*.mjs` tooling (plain Node, no new
        dependencies, spawned `kubectl`/`kind` processes).

**Phase 1 exit check**: `npm run verify:k8s` fails exactly at the structural build check (RED
confirmed); the runtime stage skips cleanly on a machine without `kind`. `npm test`,
`npm run lint`, and `npm run format:check` still pass (no collateral damage).

## Phase 2: Kustomize Base (GREEN — core)

- [x] 2.1 Create `deploy/kubernetes/namespace.yaml`, `pvc.yaml`, `service.yaml`, and
      `kustomization.yaml` (resources list, `namespace: getmando`, `images:` digest pin with the
      release tag recorded as a comment).
      - Acceptance: `kubectl kustomize deploy/kubernetes` builds; the output contains the
        Namespace, a 64Mi RWO PVC with no `storageClassName`, and a ClusterIP Service on port 80.
      - Verify: `kubectl kustomize deploy/kubernetes` (part of `npm run verify:k8s` step 1).
      - Files: `deploy/kubernetes/namespace.yaml`, `pvc.yaml`, `service.yaml`, `kustomization.yaml`.

- [x] 2.2 Create `deploy/kubernetes/deployment.yaml` per the runtime contract in `design.md`:
      image from the kustomization pin, `NODE_ENV=production`, optional `CONFIG_WRITE_TOKEN`
      `secretKeyRef`, `/app/config` volumeMount on the PVC, liveness + readiness `GET /health`,
      resources 50m/64Mi → 256Mi, `replicas: 1`, `strategy: Recreate`, the stable labels from
      `design.md` § Interfaces / Contracts.
      - Acceptance **[held: runtime]**: smoke steps 3–5 pass — `apply -k` succeeds, rollout
        reaches Ready, and port-forward assertions (bundle, `/health`, `/config/dashboard.yaml`)
        all return 200.
      - Verify: structural — `kubectl kustomize` builds cleanly on the development machine;
        runtime — `npm run verify:k8s` through step 5, **[held: runtime]**.
      - Files: `deploy/kubernetes/deployment.yaml`.

- [x] 2.3 Create `deploy/kubernetes/ingress.yaml` (placeholder host `getmando.example.com`,
      `ingressClassName: nginx`, both flagged in comments as documented patch points) and
      `deploy/kubernetes/secret.example.yaml` (copy-me template, deliberately **not** listed in
      `kustomization.yaml`).
      - Acceptance: `kubectl kustomize` output contains the Ingress and does **not** contain any
        Secret; applying the base still yields a read-only, fully working deployment
        (**[held: runtime]** for the applied behavior).
      - Verify: structural — kustomize output inspection on the development machine; runtime —
        `npm run verify:k8s` full run, including the read-only assertion ordering (step 5 runs
        before the Secret exists) and the write round-trip + persistence assertions (step 6),
        **[held: runtime]**.
      - Files: `deploy/kubernetes/ingress.yaml`, `deploy/kubernetes/secret.example.yaml`.

**Phase 2 exit check**: structural GREEN on the development machine — `kubectl kustomize` builds
and kubeconform passes. **[held: runtime]**: `npm run verify:k8s` end-to-end (see Verification
Environment). Zero changes to `Dockerfile`, `entrypoint.sh`, `nginx.conf`, `docker-compose*.yml`,
`src/`, `server/`.

## Phase 3: CI Manifest Validation

- [x] 3.1 Add a "Validate Kubernetes manifests" step to `.github/workflows/test.yml`:
      `kubectl kustomize deploy/kubernetes | kubeconform -strict -`, with a one-line download of
      the kubeconform binary (kubectl is preinstalled on `ubuntu-latest`).
      - Acceptance: the validation command demonstrably fails on a deliberately broken manifest
        (misspelled required field introduced locally, then reverted) — proving the gate has
        teeth — and passes on the real manifests. The workflow-level pass happens naturally at
        PR time once the branch is pushed.
      - Verify: run the exact command locally for the positive and deliberate-negative cases.
      - Files: `.github/workflows/test.yml`.

**Phase 3 exit check**: the validation command passes locally on the real manifests and fails on
the deliberate negative case (demonstrated and reverted); the workflow step itself is exercised
at PR time once the branch is pushed.

## Phase 4: Documentation

- [x] 4.1 Add the "Deploying on Kubernetes" section to `README.md`: one-command install, creating
      the write-token Secret (with the read-only alternative stated), overriding the pinned image
      digest/tag, the Talos no-default-StorageClass patch, a dedicated Ingress subsection
      (placeholder host and class called out, with per-controller examples for nginx and
      traefik/k3s), and running `npm run verify:k8s` locally.
      - Acceptance: each of the spec's scenarios a user can hit is addressed; every placeholder
        called out in the manifests has a matching README instruction.
      - Verify: manual read-through against `specs/kubernetes-deployment/spec.md` and
        `design.md` § Interfaces / Contracts.
      - Files: `README.md`.

- [x] 4.2 Add `deploy/kubernetes/` to the repository shape in `ARCHITECTURE.md` (one line beside
      the existing root build and delivery files).
      - Acceptance: shape section reflects the new directory.
      - Verify: manual read-through.
      - Files: `ARCHITECTURE.md`.

- [ ] 4.3 Note the `CHANGELOG.md` entry as pending until this ships in its release — add it
      together with promoting `specs/kubernetes-deployment/spec.md` into `openspec/specs/`, the
      `openspec/README.md` capability-table row, and archiving this change (see proposal § Success
      Criteria). Every subsequent release must also bump the pinned digest in
      `kustomization.yaml` (manual for v1; automating the bump inside `docker-publish.yml` is a
      recorded follow-up).
      - Acceptance: this task tracks the ship-time obligations; no premature CHANGELOG entry.
      - Verify: at release time.
      - Files: `CHANGELOG.md` (at release), `openspec/README.md` (at release).

**Phase 4 exit check**: README and ARCHITECTURE accurate against the shipped manifests; no
CHANGELOG entry yet.

## Phase 5: Full Verification + Review

- [ ] 5.1 Run the complete local gate: `npm test`, `npm --prefix server test`, `npm run lint`,
      `npm run format:check`, `npm run build -- --configuration production`, and the structural
      manifest validation (`kubectl kustomize` + kubeconform) — confirming the change touched
      none of the existing surfaces.
      - Acceptance: all green; zero diff on `Dockerfile`, `entrypoint.sh`, `nginx.conf`,
        `docker-compose*.yml`, `src/`, `server/` (proposal § Success Criteria).
      - Verify: the commands above plus `git status`/`git diff --stat` review.
      - Files: N/A (verification only).

- [ ] 5.2 **[held: runtime]** Execute the deferred runtime verification on the pushed branch: on
      a machine with `kind`, `kubectl`, and a container runtime, run `npm run verify:k8s` (full
      run — structural and runtime stages, including the write round-trip and PVC persistence
      assertions) and record the outcome, a summary of the command output, and the environment it
      ran on in this change's `verify-report.md`. This single run completes every
      **[held: runtime]** item above and the Phase 2 exit check.
      - Acceptance: `npm run verify:k8s` exits 0 end-to-end; `verify-report.md` records the pass
        and the verification environment.
      - Verify: the report entry plus the command's exit code.
      - Files: `openspec/changes/kubernetes-support/verify-report.md` (created here if not
        already).

- [ ] 5.3 `code-review-and-quality` pass over the whole change (manifests, script, CI, docs),
      comparing the implementation against every scenario in `specs/kubernetes-deployment/spec.md`.
      Any findings become numbered fix tasks in a new phase here, mirroring the
      `app-status-indicator` review phases.
      - Acceptance: review findings resolved or explicitly accepted with rationale.
      - Verify: review pass output recorded; this file updated.
      - Files: as findings dictate.

**Phase 5 exit check**: every spec scenario verified (runtime items via task 5.2); full local
gate green; review pass complete.
