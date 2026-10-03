# Proposal: Kubernetes Support

## Intent

Ship first-class Kubernetes deployment support so any homelab k8s user — stock Kubernetes, k3s,
or Talos — can run Mando with a single `kubectl apply -k`, using the same published
image, with the same flagship capability intact: the visual configurator's **Save** writing
`dashboard.yaml` to persistent storage. Today a k8s user has to hand-translate the Docker Compose
setup, and the obvious translation (a ConfigMap for the YAML) silently breaks Save.

## Scope

### In Scope
- Plain Kubernetes manifests plus a Kustomize base under `deploy/kubernetes/`: Namespace, PVC,
  Deployment, Service, Ingress, and a `kustomization.yaml`.
- Config persistence via a PVC mounted at `/app/config` — **not** a ConfigMap — so the
  configurator's Save (and the sidecar's `.bak` rotation) works exactly as under Docker.
- `replicas: 1` with `strategy: Recreate`, documented as a direct consequence of the RWO volume.
- `CONFIG_WRITE_TOKEN` sourced from a Secret through an **optional** `secretKeyRef`: with no
  Secret, the deployment runs read-only (Save disabled, dashboard and status checks serve) —
  mirroring today's Docker `:ro` story.
- Liveness and readiness probes on the existing `/health` endpoint.
- A CI gate in `.github/workflows/test.yml`: `kubectl kustomize` build plus kubeconform schema
  validation for the base.
- A kind-based smoke-test script (`scripts/verify-k8s.mjs`, exposed as `npm run verify:k8s`) that
  applies the manifests to a throwaway kind cluster and exercises `/health`, the Angular bundle,
  `/config/dashboard.yaml` from the PVC, and a `POST /api/config` round-trip. Prerequisites are
  checked per stage — the structural check needs only `kubectl`, the runtime stages additionally
  need `kind` — so the script skips (never fails) on machines without container tooling while
  still validating structure where partial tooling exists.
- A README "Deploying on Kubernetes" section covering: install, the write token Secret, Talos's
  missing default StorageClass, a dedicated Ingress subsection (host/class placeholders with
  per-controller examples), and image digest pinning/overriding.

### Out of Scope
- OpenShift/OKD support — descoped in change review. It is enterprise-oriented, a rounding error in
  the homelab audience, and the only platform that required extra artifacts (a Route overlay, SCC
  documentation, CI schema special-casing, a manual OKD verification pass). The base manifests
  still apply on OpenShift if an operator grants the `anyuid` SCC themselves — it is simply not
  documented, tested, or supported.
- A Helm chart. Kustomize-first in v1; a chart is a recorded follow-up if users ask for it.
- Any change to the published image: no `nginx-unprivileged` migration, no port change, no
  splitting nginx and the write sidecar into two containers of one pod. The image is treated as a
  fixed artifact the manifests consume.
- Multiple replicas / HPA — impossible with a single RWO PVC and unnecessary for a homelab
  dashboard.
- TLS termination, cert-manager, or Gateway API — homelab users run their own ingress stack; we
  ship a plain Ingress with a documented placeholder host.
- Any application, sidecar, Dockerfile, or entrypoint change.

## Capabilities

### New Capabilities
- `kubernetes-deployment`: declarative Kustomize manifests, Secret-based write token, PVC-backed
  config persistence, health probes, CI manifest validation, and a local kind smoke-test harness.

### Modified Capabilities
- None. Nothing that ships today changes: no app code, no sidecar code, no image, no Docker
  deployment files.

## Approach

Kubernetes users get a directory they can `kubectl apply -k` (or point Flux/Argo CD at, both of
which consume Kustomize natively). The base mirrors the Docker Compose contract one-to-one: the
same image, the same `/app/config` mount point — backed by a PVC instead of a bind mount — the
same `NODE_ENV=production`, and the same `/health` endpoint reused as kubelet probes. The write
token moves from a compose environment entry to a Secret the operator creates, referenced
optionally so a read-only deployment needs no Secret at all. Verification follows the project's
test-first ethos translated to infrastructure: the smoke-test script is written before the
manifests (it fails — there is nothing to apply), then the manifests are built until it passes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `deploy/kubernetes/` | New | Kustomize base (namespace, PVC, deployment, service, ingress, example secret, kustomization) |
| `scripts/verify-k8s.mjs` | New | kind-based smoke test: apply, wait for rollout, exercise `/health`, config read, and a write round-trip |
| `package.json` | Modified | `verify:k8s` npm script |
| `.github/workflows/test.yml` | Modified | Manifest validation step: `kubectl kustomize` + kubeconform for base and overlay |
| `README.md` | Modified | "Deploying on Kubernetes" section (install, token, Talos StorageClass, ingress, pinning) |
| `ARCHITECTURE.md` | Modified | `deploy/kubernetes/` added to the repository shape |
| `CHANGELOG.md` | Modified | New-feature entry, added when this ships in its release |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Vanilla Talos ships no default StorageClass; the PVC stays `Pending` and the pod never schedules | High on Talos | PVC deliberately omits `storageClassName` (so every cluster with a default works untouched); README documents the one-line patch to name a class (local-path, Longhorn, Rook…) |
| A mutable image reference makes rollouts non-reproducible — `:latest` also flips kubelet to `imagePullPolicy: Always`, and even a tag can be repushed upstream | Medium | `kustomization.yaml` pins the image **by digest** via the `images:` transformer, with the release tag recorded as a comment; the release process owns the digest bump each release (manual for v1, automation in `docker-publish.yml` recorded as a follow-up); README shows overriding it |
| Users apply the shipped example Secret and run with a guessable token | Medium | `secret.example.yaml` is deliberately **not** referenced by `kustomization.yaml`; the README path creates the Secret with `kubectl create secret` |
| Placeholder ingress host (`getmando.example.com`) and class (`nginx`) confuse traefik/k3s users | Medium | README documents the one-line patch for `ingressClassName: traefik` and the host |
| `Recreate` strategy means a short outage on every image update | Low | Accepted: single replica by design; a homelab dashboard tolerates seconds of downtime |
| Manifests drift from the Docker contract (env, paths, ports) as either evolves | Medium | CI validates structure on every PR; the smoke test asserts the runtime contract against the real image |

## Rollback Plan

Delete `deploy/kubernetes/`, `scripts/verify-k8s.mjs`, the `verify:k8s` npm script, the CI
validation step, and the README/ARCHITECTURE sections. There is no application, sidecar, image, or
Docker change to revert, so rollback cannot affect any existing Docker deployment.

## Dependencies

No new npm dependencies. CI uses `kubectl` (preinstalled on `ubuntu-latest`) and downloads the
kubeconform binary in one step. The local smoke test requires `kind`, `kubectl`, and a container
runtime; the script skips with a clear message when they are absent so it never blocks contributors
who don't have them.

## Success Criteria

- [ ] `kubectl apply -k deploy/kubernetes` on a fresh kind or k3s cluster produces a Ready pod
      serving the dashboard at the Service.
- [ ] A Save from `/configure` survives pod deletion and rescheduling (PVC persistence).
- [ ] With no Secret created, the dashboard runs read-only (Save disabled, `POST /api/config`
      401s); with the Secret, Save works.
- [ ] `kubectl kustomize` and kubeconform pass in CI for the base.
- [ ] `npm run verify:k8s` passes locally against kind.
- [ ] README covers the k3s and Talos paths, including the StorageClass caveat.
- [ ] `git diff` shows zero changes to `Dockerfile`, `entrypoint.sh`, `nginx.conf`,
      `docker-compose*.yml`, `src/`, and `server/`.
- [ ] Ships in its release with `specs/kubernetes-deployment/spec.md` promoted into
      `openspec/specs/`, the `openspec/README.md` capability table row added, and this change
      archived.

## Resolved Questions

All were settled in the design pass (OpenShift was later descoped in review) and are recorded with
full rationale in `design.md` (§ Architecture Decisions):

- PVC vs ConfigMap for `dashboard.yaml` → PVC; a ConfigMap is read-only in every kubelet mount
  mode and would silently break the configurator's Save.
- Helm vs plain manifests + Kustomize → Kustomize; GitOps tools consume it natively and there is
  no values-matrix to maintain for a fixed-shape, single-workload deployment.
- OpenShift/OKD → descoped in review: enterprise-grade platform, negligible homelab audience, and
  the only distro requiring extra artifacts (Route overlay, SCC documentation, CI
  special-casing, manual OKD verification). The base manifests still apply there if the operator
  grants the `anyuid` SCC themselves — unsupported and undocumented.
- Probe endpoint → `/health` for both liveness and readiness (same signal the Docker HEALTHCHECK
  uses); using the not-yet-shipped `/api/status` as readiness was considered and deferred.
