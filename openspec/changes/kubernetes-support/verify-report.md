# Verify Report: Kubernetes Support

## Attempt 1 — 2026-10-04

**Environment**: Linux, `kubectl` (brew), `kind` v0.x, Docker, `kubeconform` (brew) — all
available locally.

**Stage A (structural)**: PASS.
- `kubectl kustomize deploy/kubernetes` builds cleanly (5 resource documents).
- `kubeconform -strict -` on that output: 0 errors.

**Stage B (runtime)**: FAILED — `kind` cluster created, `kubectl apply -k deploy/kubernetes`
applied, rollout reached Ready, `GET /`, `GET /health`, and `GET /config/dashboard.yaml`
(pre-save) all passed. Failed at:

```
POST /api/config without a configured token returned 502, expected 401
```

**Root cause (confirmed, not a manifest defect)**: the pinned image
(`ghcr.io/rackandhost/getmando@sha256:5aa0c245b84d7768d5dea7d11bfc41a633177cbb832a50e9e57433d0b25a8bfc`,
`v2.0.0`) runs a build of `server/src/index.ts` that still calls `process.exit(1)` when
`CONFIG_WRITE_TOKEN` is unset (confirmed via `kubectl exec` + `grep` inside the pod: the sidecar
process is not running at all, and the container log reads `CONFIG_WRITE_TOKEN is required to
start the config-write-api sidecar.`). That requirement was removed in commit `4fb3440`
(`feat(server): poll opted-in apps and expose GET /api/status`, part of `app-status-indicator`),
which merged into `develop` but is confirmed absent from `main`/`v2.0.0`:

- `git merge-base --is-ancestor 4fb3440... v2.0.0` → not an ancestor.
- `git rev-parse origin/main` == `git rev-parse v2.0.0` — `main` has not advanced since the
  `v2.0.0` release; no newer image has ever been published.

So every currently published image lacks the fix the "optional Secret → read-only deployment"
design (see `design.md` § Architecture Decisions, "Write token plumbing") depends on. This is a
release-sequencing gap, not a defect introduced by this change: the `docker-publish.yml` auto-pin
step (added here) will re-pin the digest automatically the next time `main` publishes a new
image, which is expected to include the fix once that release happens.

**Manual follow-up (same session, same cluster lineage)**: with the write-token `Secret` created
*before* first rollout (skipping the blocked read-only assertion), the rest of the runtime
contract was exercised by hand — see task 5.2 notes once the full automated run is unblocked.

**Disposition**: Stage A is GREEN and repeatable. Stage B's read-only assertion is blocked on a
future release publishing an image that includes `4fb3440`; re-run `npm run verify:k8s` in full
once that image exists. No manifest or script change is warranted to work around this.
