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

- [x] 5.1 Run the complete local gate: `npm test`, `npm --prefix server test`, `npm run lint`,
      `npm run format:check`, `npm run build -- --configuration production`, and the structural
      manifest validation (`kubectl kustomize` + kubeconform) — confirming the change touched
      none of the existing surfaces.
      - Acceptance: all green; zero diff on `Dockerfile`, `entrypoint.sh`, `nginx.conf`,
        `docker-compose*.yml`, `src/`, `server/` (proposal § Success Criteria).
      - Verify: the commands above plus `git status`/`git diff --stat` review.
      - Files: N/A (verification only).
      - Result (2026-10-04): all six green (306/306 + 11/11 focused-guard tests, 49/49 server
        tests, lint, format:check, production build, kubeconform `-strict`). Production bundle
        exceeds its 500 kB budget by ~243 kB — pre-existing, zero diff on `src/`, out of scope for
        this change. Zero diff confirmed on `Dockerfile`, `entrypoint.sh`, `nginx.conf`,
        `docker-compose*.yml`, `src/`, `server/`.

- [ ] 5.2 **[held: runtime]** — **blocked, not a manifest defect**: run on a machine with `kind`,
      `kubectl`, and a container runtime; see `verify-report.md` for the attempted run.
      `npm run verify:k8s` fails today at the `POST /api/config` (no token) assertion — it gets
      502, not the expected 401 — because the only published image (`ghcr.io/rackandhost/getmando`
      pinned by digest, built from the `v2.0.0` tag) still exits the sidecar process when
      `CONFIG_WRITE_TOKEN` is unset. That exit(1) requirement was removed in `4fb3440`
      (`feat(server): poll opted-in apps and expose GET /api/status`), which shipped as part of
      `app-status-indicator` into `develop` — confirmed *not* an ancestor of `v2.0.0`
      (`git merge-base --is-ancestor`) and *not* on `main` (`origin/main` is still exactly the
      `v2.0.0` commit; no image has been published since). The docker-publish auto-pin step
      (added in this same change) will self-correct the digest the next time `main` advances and
      publishes a new image — expected to include this fix once that release happens. Re-run this
      task once that image exists; do not change the manifests or the smoke test's assertions to
      work around it.
      - Acceptance: `npm run verify:k8s` exits 0 end-to-end; `verify-report.md` records the pass
        and the verification environment.
      - Verify: the report entry plus the command's exit code.
      - Files: `openspec/changes/kubernetes-support/verify-report.md` (created here if not
        already).

- [x] 5.3 `code-review-and-quality` pass over the whole change (manifests, script, CI, docs),
      comparing the implementation against every scenario in `specs/kubernetes-deployment/spec.md`.
      Findings below in Phase 6, mirroring the `app-status-indicator` review phases.
      - Acceptance: review findings resolved or explicitly accepted with rationale.
      - Verify: review pass output recorded; this file updated.
      - Files: as findings dictate.
      - Result (2026-10-04): reviewed all 18 changed files against the five axes
        (correctness/readability/architecture/security/performance) and every scenario in
        `specs/kubernetes-deployment/spec.md`; manually exercised the full runtime contract
        (write round-trip, PVC persistence) against a local kind cluster. 5 findings recorded in
        Phase 6. No Critical findings — the one blocker-grade issue (pinned image predates the
        sidecar's optional-token fix) was already captured in task 5.2/`verify-report.md`.

**Phase 5 exit check**: every spec scenario verified (runtime items via task 5.2); full local
gate green; review pass complete.

## Phase 6: Review Pass Findings

Findings from the `code-review-and-quality` pass (task 5.3) over the full `develop..HEAD` diff.

- [x] 6.1 (Required) `scripts/verify-k8s.mjs` has no `SIGINT`/`SIGTERM` handler, so interrupting a
      Stage B run (e.g. Ctrl-C) skips the `finally` teardown and leaves the `getmando-smoke` kind
      cluster (and any `kubectl port-forward` child) running. The next run then fails at
      `kind create cluster` ("already exists") instead of the clean run the script promises. This
      breaks the contract stated in `design.md`'s Interfaces/Contracts and task 1.1: "torn down on
      exit even on failure."
      - Acceptance: a Ctrl-C during Stage B tears down the cluster and port-forward before the
        process exits; a stale cluster from a prior interrupted run doesn't block a fresh run.
      - Verify: manually interrupt a run mid-Stage-B, confirm `kind get clusters` is empty
        afterward; confirm a second `npm run verify:k8s` run succeeds immediately after.
      - Files: `scripts/verify-k8s.mjs`.
      - Result (2026-10-04): added `SIGINT`/`SIGTERM` handlers that call the existing
        `teardownCluster`, plus a `deleteStaleClusterIfPresent` guard before `kind create cluster`
        for the harder case (`SIGKILL`/host crash) a handler can't catch. Verified against the
        real PID (not a job-control artifact): sent `SIGINT` mid-Stage-B — the cluster and
        port-forward were torn down cleanly with no leak (`kind get clusters` empty afterward).
        Caveat worth recording: the handler only runs once Node's event loop regains control, so
        if the signal arrives while blocked inside a synchronous `kubectl`/`kind` `spawnSync` call,
        teardown is deferred until that call returns — still strictly better than the prior
        behavior (an unhandled signal killed the process immediately with zero cleanup, every
        time). Separately confirmed: pre-seeding a stale `getmando-smoke` cluster before a run, the
        script detects and deletes it before creating a new one, exactly as 6.1 requires.

- [x] 6.2 (Nit) `deployment.yaml`'s `readinessProbe` has no `initialDelaySeconds` (defaults to
      `0`), guaranteeing a "connection refused" probe-failure event while nginx is still starting
      (observed in the smoke-test run). Cosmetic only — self-heals within one `periodSeconds` and
      never affects rollout success — but noisy in `kubectl describe`/events.
      - Acceptance: no spurious readiness-probe-failed event on a normal pod start.
      - Verify: `kubectl describe pod` after a fresh rollout shows no `Unhealthy` readiness event.
      - Files: `deploy/kubernetes/deployment.yaml`.
      - Result (2026-10-04): added `initialDelaySeconds: 5`. Re-validated structurally
        (`kubectl kustomize | kubeconform -strict -` → exit 0); the same value the liveness probe
        already waited before its first check.

- [x] 6.3 (Nit) `.github/workflows/test.yml`'s kubeconform download (`curl -sSL ... | tar xz`) has
      no checksum or signature verification — a compromised or substituted release would execute
      inside the CI job with the job's token and environment. Low likelihood (pinned version,
      GitHub Releases) but cheap to close.
      - Acceptance: the download is verified against a pinned SHA-256 before extraction.
      - Verify: a deliberately corrupted download fails the step instead of silently extracting.
      - Files: `.github/workflows/test.yml`.
      - Result (2026-10-04): pinned the official release checksum
        (`9bc2bffbf71f2...466ec287883`, confirmed against both the release's published `CHECKSUMS`
        file and a fresh local download) and gated extraction on `sha256sum -c`. Verified both
        directions locally: the real binary passes and still validates the manifests (exit 0); a
        corrupted file fails `sha256sum -c` with exit 1 before `tar` ever runs.

- [x] 6.4 (Optional) `.github/workflows/docker-publish.yml`'s auto-pin step pushes a commit
      directly to `main` using the default `GITHUB_TOKEN` (`contents: write`), bypassing any PR
      review for that commit. If `main`'s branch protection requires pull requests, this push will
      fail silently-ish (the job errors, but nothing alerts that the digest never got pinned,
      which compounds with finding 6.1's sibling concern about the image/Secret mismatch staying
      unnoticed). Confirm branch protection explicitly permits this, or add a job-failure
      notification.
      - Acceptance: either branch protection is confirmed compatible, or the workflow alerts when
        the push fails.
      - Verify: manual confirmation against the repository's branch protection settings.
      - Files: `.github/workflows/docker-publish.yml` (or repository settings; no code change may
        be needed).
      - Result (2026-10-04): confirmed via `gh api repos/rackandhost/getmando/rulesets/8629865`
        that the "Dev" ruleset (covers `main` and `develop`) requires a PR with 1 approval + code
        owner review, with zero bypass actors — the default `GITHUB_TOKEN` push would have failed
        every time. Resolution: a dedicated collaborator bot account (`randhbot`, Write access,
        not Admin) was added as a ruleset bypass actor (`actor_type: User`, `bypass_mode: always`)
        scoped to that one identity — confirmed present via `.bypass_actors` after the repo owner
        applied it (requires Admin, which the implementing account does not have). The workflow
        now checks out with a classic PAT (`KUBE_DIGEST_BOT_TOKEN`, scope `repo`, fine-grained PATs
        are unsupported for outside/repository collaborators per GitHub's own documented
        limitation) instead of `GITHUB_TOKEN`, so the push authenticates as `randhbot`. The job's
        `permissions.contents: write` was removed as now-unused (the push no longer uses
        `GITHUB_TOKEN`). Loop safety re-verified for the new credential: GitHub's
        GITHUB_TOKEN-authored-push loop suppression does not apply to a real user's PAT, but the
        commit's existing `[skip ci]` marker (unchanged) independently prevents re-triggering this
        workflow regardless of which credential pushed it.

- [ ] 6.5 (FYI) `scripts/check-focused-tests.mjs`'s Windows-portability fix (`pathToFileURL` guard,
      POSIX-normalized paths) is unrelated to Kubernetes support but bundled into this change at
      the maintainer's explicit request — already disclosed with rationale in `tasks.md` §
      Verification Environment. No action needed; recorded here only so the review record notes
      the mixed-concern commit was deliberate, not accidental.
      - Acceptance: n/a — informational.
      - Verify: n/a.
      - Files: `scripts/check-focused-tests.mjs`.

**Phase 6 exit check**: 6.1 fixed and verified (it's the only Required/Critical-adjacent finding);
6.2–6.4 fixed or explicitly deferred with rationale; 6.5 needs no action.
