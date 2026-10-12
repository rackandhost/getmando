# Design: Kubernetes Support

## Technical Approach

The published image is already close to Kubernetes-ready by accident of its Docker design: a
single process tree (tini → nginx + Node sidecar) means one container with no composition to
model, `/health` is a kubelet-shaped probe endpoint, and all mutable state lives behind one mount
point (`/app/config`). The Kubernetes work is therefore not building anything new — it is
translating the Docker Compose contract into declarative resources, and being deliberate about the
one place where the platforms genuinely differ: **where `dashboard.yaml` lives** (a bind mount
becomes a PVC, because a ConfigMap is read-only to the kubelet and would silently break the
configurator's Save). The image runs as-is on every targeted distro — stock k8s, k3s, and Talos
are all plain Kubernetes to a manifest; OpenShift, the one distro that would have required extra
artifacts and an SCC grant, is descoped in change review (see `proposal.md` § Out of Scope).

The deliverable is a Kustomize base under `deploy/kubernetes/` that a user applies with
`kubectl apply -k` — or, just as commonly in homelabs, points Flux or Argo CD at, both of which
consume Kustomize natively with no extra packaging. Every cluster-facing choice that a homelab
distro disagrees about (StorageClass, ingress controller, hostnames, image tag) is either left to
cluster defaults or a documented one-line Kustomize patch, never a fork of the manifests.

Verification translates the project's strict TDD rule to infrastructure-as-code, where there are
no unit tests to write: the "RED" step is `scripts/verify-k8s.mjs` — a kind-based smoke test
written first, failing because there are no manifests to apply — and the "GREEN" step is the
manifest set, built until the smoke test passes. The script asserts the *runtime* contract
against the real image (bundle served, config read from the PVC, write round-trip through the
sidecar), not just YAML validity; structural validation (`kubectl kustomize` + kubeconform) runs
in CI on every PR as the cheap gate.

## Manifest Layout

```text
deploy/
  kubernetes/
    kustomization.yaml        # resources list + images: digest pin + namespace
    namespace.yaml            # Namespace getmando
    pvc.yaml                  # PVC getmando-config, RWO, 64Mi, no storageClassName
    deployment.yaml           # 1 replica, Recreate, probes on /health, optional Secret ref
    service.yaml              # ClusterIP, port 80
    ingress.yaml              # placeholder host + ingressClassName: nginx
    secret.example.yaml       # copy-me template; NOT referenced by kustomization.yaml
```

## Architecture Decisions

| Decision | Options and tradeoff | Choice and rationale |
|---|---|---|
| Packaging format | (a) Plain manifests + Kustomize vs (b) Helm chart vs (c) plain manifests only, no Kustomize | (a). The deployment has a fixed shape — one workload, one volume, one service — so Helm's values-matrix would be all ceremony and no leverage, and a chart is a maintained artifact with its own versioning. Kustomize gives the one thing users actually need (overriding tag, namespace, ingress class without forking) and is consumed natively by Flux and Argo CD. A Helm chart is recorded as a follow-up if demand appears. |
| Where `dashboard.yaml` lives | (a) PVC mounted at `/app/config` vs (b) ConfigMap | (a). The configurator's Save — the project's flagship capability — writes through `POST /api/config` to that path; ConfigMaps are read-only in every kubelet mount mode, so (b) would ship a dashboard whose Save button silently 405s. The cost of (a): single replica and `Recreate` (next row), both acceptable for a homelab dashboard. GitOps-purists who *want* config-in-git still have the file-based workflow — they patch the volume source, and the README says so. |
| Replicas & update strategy | (a) `replicas: 1` + `strategy: Recreate` vs (b) `RollingUpdate` vs (c) multiple replicas | (a). A default StorageClass volume is `ReadWriteOnce`: `RollingUpdate` deadlocks (the new pod can't schedule while the old one holds the volume), and multiple replicas can't share the volume — and would fight over the YAML anyway. `Recreate` makes the trade-off honest: brief downtime on updates, zero surprise. |
| The image | (a) Consume the stock `ghcr.io/rackandhost/getmando` image vs (b) restructure for k8s (nginx + sidecar as two containers in one pod, or nginx-unprivileged base) | (a). "Best practice" would split the pod and run non-root — but that means maintaining a second runtime shape (or breaking every existing `-p 8080:80` Docker user). One image, one contract, everywhere. The pod-split buys nothing functionally: tini already reaps and forwards signals, and the two processes share one fate by design (a pod restarts both regardless). |
| Write token plumbing | (a) Required Secret referenced by the Deployment vs (b) optional `secretKeyRef` (`optional: true`) vs (c) plain env value in the manifest | (b). A required Secret makes `apply -k` fail on a fresh cluster before the operator has created anything — hostile as a first-run experience. An optional reference degrades exactly the way the Docker `:ro` story does: no Secret → token unset → dashboard serves, Save disabled, `POST /api/config` 401s (the sidecar's existing auth behavior). (c) is a non-starter: it invites committed tokens. |
| Probe endpoint | (a) `/health` (nginx-served) for both liveness and readiness vs (b) readiness on `/api/status` (sidecar-served) so probes also cover the write sidecar | (a). `/health` is the same signal the Docker HEALTHCHECK uses and covers what kubelet needs: "is the web tier answering". (b) is attractive — a dead sidecar would flip readiness and stop the Service routing to a half-broken pod — but `/api/status` doesn't exist yet (it ships with `app-status-indicator`, still an active change), and this change must not hard-depend on an unshipped route. Recorded as a one-line readiness upgrade once that change lands. Known limitation meanwhile: a crashed sidecar leaves the pod Ready with `/api/*` 502ing — identical to the Docker blind spot today. |
| Ingress | (a) Ship an Ingress with placeholder host + `ingressClassName: nginx` vs (b) omit Ingress entirely vs (c) Gateway API | (a). Most homelab k8s users have an ingress controller and expect the project to meet them there; omitting it just moves the YAML into every user's notes. The placeholder (`getmando.example.com`, class `nginx`) is a documented one-line patch — k3s/traefik users change the class, everyone changes the host. TLS/cert-manager/Gateway API stay out: homelabbers run their own edge stack. |
| Namespace | (a) Ship a `Namespace` manifest + `namespace:` in kustomization vs (b) namespace-neutral resources applied with `-n` | (a). `apply -k` with no `-n` must land somewhere predictable; a shipped Namespace makes the install one command and still trivially patchable (`namespace:` override in a user overlay deletes cleanly). |
| Image reference | (a) Pin by digest in kustomization `images:` (release tag kept as a comment) vs (b) pin by tag only vs (c) `:latest` in the Deployment | (a), per change review. A tag is mutable — upstream can repush it — so only a digest guarantees the applied manifest runs exactly what was reviewed; `:latest` additionally flips kubelet to `imagePullPolicy: Always`. The tradeoffs (digests are unreadable, and must be bumped every release) are handled by recording the tag as a comment beside the digest and by the release process owning the bump — a ship-time obligation recorded in `tasks.md`. Overriding with a tag or a digest stays the standard Kustomize idiom. |
| PVC spec | (a) No `storageClassName` (cluster default), 64Mi, RWO vs (b) name a provisioner | (a). Naming a provisioner picks a winner among k3s local-path / Longhorn / Rook / OpenShift and breaks everyone else; omitting it works untouched on every cluster with a default StorageClass. The one real gap — vanilla Talos ships none — is a README-documented one-line patch. 64Mi holds a lifetime of `dashboard.yaml` + `.bak` rotations; access is `ReadWriteOnce` by the single-replica decision. |
| CI validation | (a) `kubectl kustomize` + kubeconform, no cluster in CI vs (b) a kind job in CI running the smoke test | (a) for v1. Structural validation catches the common failure (a manifest edit that stops building or violates a schema) for ~15 seconds of CI; a kind job costs minutes and Docker-in-Docker churn for the rest. The kind smoke test stays a local, on-demand `npm run verify:k8s` (plus a release-time manual run) — (b) is a follow-up if manifest churn proves high. |
| Verification under `strict_tdd` | (a) Treat manifests as untestable and verify by review vs (b) smoke-test-first: write the failing harness, then the manifests | (b). RED/GREEN has a direct translation: the kind smoke test written first fails (`deploy/kubernetes` doesn't exist / apply errors), and the implementation phase ends when it passes. It keeps the project's test-first rule honest for infrastructure instead of suspending it. |

## Deployment Topology

```text
kubectl apply -k deploy/kubernetes
  -> Namespace getmando
  -> PVC getmando-config          (default StorageClass, RWO, 64Mi)
  -> [operator-created] Secret getmando-config-write (key CONFIG_WRITE_TOKEN)
  -> Deployment getmando          (replicas: 1, strategy: Recreate)
       container ghcr.io/rackandhost/getmando@sha256:<pinned digest>
         env    NODE_ENV=production
                CONFIG_WRITE_TOKEN <- secretKeyRef (optional: true)
         mount  /app/config <- PVC getmando-config
         probes liveness  GET /health   (initialDelay 10s, period 10s, failureThreshold 3)
                readiness GET /health   (period 10s)
  -> Service getmando             (ClusterIP, 80 -> 80)
  -> Ingress getmando             (host getmando.example.com [placeholder], class nginx [placeholder])

browser -> Ingress -> Service -> nginx :80
   /                      -> Angular bundle (immutable hashed assets)
   /config/dashboard.yaml -> /app/config/dashboard.yaml (PVC) via nginx alias
   /api/*                 -> write sidecar :3000 via nginx proxy_pass (pod loopback)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `deploy/kubernetes/kustomization.yaml` | Create | Resources list, `namespace: getmando`, `images:` digest pin (release tag as a comment) |
| `deploy/kubernetes/namespace.yaml` | Create | `Namespace getmando` |
| `deploy/kubernetes/pvc.yaml` | Create | `PersistentVolumeClaim getmando-config` — RWO, 64Mi, no `storageClassName` |
| `deploy/kubernetes/deployment.yaml` | Create | Single-replica `Recreate` Deployment per the topology above |
| `deploy/kubernetes/service.yaml` | Create | `Service getmando`, ClusterIP, 80 |
| `deploy/kubernetes/ingress.yaml` | Create | Ingress with placeholder host/class, both called out in comments |
| `deploy/kubernetes/secret.example.yaml` | Create | Copy-me template; deliberately unreferenced by `kustomization.yaml` |
| `scripts/verify-k8s.mjs` | Create | kind smoke test: build image or use `imagePullPolicy`-compatible tag, create cluster, apply `-k`, assert runtime contract, tear down |
| `package.json` | Modify | `"verify:k8s": "node scripts/verify-k8s.mjs"` |
| `.github/workflows/test.yml` | Modify | Manifest validation step: `kubectl kustomize deploy/kubernetes` piped to kubeconform `-strict` (no custom resources exist, so nothing is skipped) |
| `README.md` | Modify | "Deploying on Kubernetes" section |
| `ARCHITECTURE.md` | Modify | `deploy/kubernetes/` in the repository shape |
| `CHANGELOG.md` | Modify | Entry added when this ships in its release (per the proposal's Success Criteria) |

## Interfaces / Contracts

The manifest set's public surface — names and labels are API; changing them later is a breaking
change for every user overlay:

```yaml
# Names (stable contract)
Namespace:      getmando
Deployment:     getmando
Service:        getmando                # port 80
Ingress:        getmando
PVC:            getmando-config         # mounted at /app/config
Secret:         getmando-config-write   # key: CONFIG_WRITE_TOKEN (operator-created, optional)

# Labels (stable contract)
app.kubernetes.io/name: getmando
app.kubernetes.io/part-of: getmando
app.kubernetes.io/component: dashboard
```

```yaml
# Deployment runtime contract (mirrors the Docker Compose contract one-to-one)
image: ghcr.io/rackandhost/getmando@sha256:<digest>   # digest pinned in kustomization.yaml,
                                                      # release tag recorded as a comment beside it
env:
  NODE_ENV: production
  CONFIG_WRITE_TOKEN: <Secret getmando-config-write / CONFIG_WRITE_TOKEN>   # optional
volumeMounts:
  /app/config  <- PVC getmando-config
probes:
  liveness + readiness: GET /health
resources:
  requests: { cpu: 50m, memory: 64Mi }
  limits:   { memory: 256Mi }
strategy: { type: Recreate }
replicas: 1
```

```text
# scripts/verify-k8s.mjs contract
- Prerequisites are checked per stage, never all up front:
    Stage A (structural) requires only kubectl.
    Stage B (runtime) additionally requires kind and a running container runtime.
  A stage whose prerequisite is missing prints "skipped: <missing tool>" and does not run;
  skipped stages never fail the run, while a stage that runs and fails its assertions exits 1.
  Partial tooling therefore yields partial verification — a kubectl-only machine still catches a
  broken kustomization, and a machine with no kubectl at all skips cleanly and never blocks an
  unrelated contributor.
- Stage A (structural, no cluster):
  1. kubectl kustomize deploy/kubernetes
- Stage B (runtime):
  2. kind create cluster (fixed name, torn down on exit)
  3. kubectl apply -k deploy/kubernetes
  4. kubectl rollout status deployment/getmando -n getmando     (fail -> RED)
  5. port-forward + assert:
       GET /                      -> 200, contains the app shell markup
       GET /health                -> 200 "healthy"
       GET /config/dashboard.yaml -> status < 500 (404 before any save: nginx aliases the PVC
                                    path to a file that does not exist yet; the app serves its
                                    built-in defaults when that load fails)
       POST /api/config (no write token configured) -> 401   (read-only deployment)
  6. kubectl create secret ... CONFIG_WRITE_TOKEN=smoke-test
     kubectl rollout restart deployment/getmando -n getmando; wait
     POST /api/config (valid minimal dashboard.yaml, token auth) -> 200 {status:"saved"}
     GET /config/dashboard.yaml   -> 200, contains what was posted
     kubectl delete pod -l app.kubernetes.io/name=getmando; wait for reschedule
     GET /config/dashboard.yaml   -> still contains what was posted   (PVC persistence)
  7. kind delete cluster
```

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Build (CI, every PR) | The kustomization builds; every resource validates against the upstream k8s OpenAPI schema | `kubectl kustomize deploy/kubernetes \| kubeconform -strict -` — no custom resources exist, so nothing is skipped |
| Smoke (local, on demand) | `apply -k` produces a Ready pod on a clean cluster; the runtime contract holds (bundle, `/health`, config read, write round-trip); the write survives pod rescheduling (PVC) | `npm run verify:k8s` per the script contract above — this is the RED/GREEN harness for the whole change |
| Smoke (negative) | Read-only mode: with no Secret, `POST /api/config` 401s and the dashboard still serves | Step 5 runs before the Secret is created in step 6 — the ordering is the test |
| Regression | Docker path untouched | CI diff check is overkill; the proposal's Success Criteria includes a zero-diff assertion over `Dockerfile`, `entrypoint.sh`, `nginx.conf`, `docker-compose*.yml`, `src/`, `server/` at review time |

Strict-TDD mapping: the harness (script) is written first and must fail — RED is "nothing to
apply". Each manifest lands only to move a specific smoke assertion from failing to passing; the
phase exit checks in `tasks.md` name the assertion each phase buys.

Verification environment: this change is developed on a machine without container tooling, with
the branch kept local until the work is complete. Structural validation runs there — the build
check needs only a standalone `kubectl` binary (no container runtime, no cluster), and kubeconform
validates schemas the same way CI does. The runtime smoke run is deferred until the branch is
pushed, then executed by a team member with the required container tooling, with the outcome
recorded in the change's `verify-report.md`. The script's stage-scoped prerequisite checking is
what makes this split safe: a machine without `kind` gets the full structural stage and never a
false failure from the runtime stage it cannot run. The handoff protocol and the **[held:
runtime]** task tagging live in `tasks.md` § Verification Environment.

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Secret leakage through the repo | Applicable — the token is a shared write secret | `secret.example.yaml` is unreferenced by the kustomization so `apply -k` can never materialize a placeholder token; the README path uses `kubectl create secret` (nothing token-shaped ever enters git) | Smoke test asserts apply+run works with **no** Secret present (read-only mode), proving the example file is not load-bearing |
| Unauthenticated exposure of `/config/dashboard.yaml` and `/api/*` through the Ingress | Applicable — but pre-existing: identical under Docker port-mapping | README section states it plainly (same guidance as the Docker docs): keep the dashboard internal or behind the operator's own access control; the Ingress is HTTP-only and TLS stays the operator's edge concern | N/A (guidance, not code) |
| Resource starvation of co-tenant homelab workloads | Low | Requests/limits on the Deployment (50m/64Mi → 256Mi) so the dashboard is a bounded neighbor | Review-time check against the manifest contract |
| Image supply chain | Low — same image as Docker | Digest pinned in `kustomization.yaml` (a mutable tag can be repushed upstream; a digest cannot), with the release tag recorded as a comment and the release process owning each bump; `imagePullPolicy` defaults to `IfNotPresent` for a non-`latest` reference | CI build check asserts the kustomization output references a digest, not a bare tag |

## Migration / Rollout

Purely additive: a new directory, a new script, one CI step, and documentation. No existing
behavior — Docker, app, or sidecar — changes, so there is no migration for current users and no
ordering constraint with the in-flight `app-status-indicator` change (the one interaction, using
`/api/status` as the readiness probe, is deliberately deferred until that change ships). OpenShift
was descoped during change review before any implementation: the base manifests remain applicable
there at the operator's own initiative, unsupported.

## Decisions (resolved — see Resolved Questions in proposal.md)

- **PVC over ConfigMap**: Save is the flagship capability; a ConfigMap mount is read-only and
  would silently break it. Cost accepted: `replicas: 1` + `Recreate`.
- **Kustomize over Helm**: fixed-shape single workload; Flux/Argo CD consume Kustomize natively;
  no values-matrix to maintain. Helm recorded as a follow-up if demanded.
- **Stock image, unchanged**: no pod-split, no `nginx-unprivileged` migration. The k8s
  "best practice" rework would break the Docker contract for zero functional gain.
- **Image pinned by digest** (change review): stronger than a tag pin — tags can be repushed
  upstream, digests cannot. The release tag rides along as a comment, and the release process
  owns the digest bump each release (manual for v1; automating it in `docker-publish.yml` is a
  recorded follow-up).
- **OpenShift/OKD descoped** (change review): enterprise-grade platform, negligible homelab
  audience, and the only distro requiring extra artifacts (Route overlay, SCC documentation, CI
  special-casing, manual OKD verification). The base manifests still apply there if the operator
  grants the `anyuid` SCC themselves — unsupported and undocumented.
- **Optional Secret for the write token**: absent Secret = read-only deployment, mirroring the
  Docker `:ro` story; `apply -k` never fails on a fresh cluster for want of a Secret.
- **Probes on `/health`**: same signal as the Docker HEALTHCHECK; sidecar-death blindness is the
  same as Docker today. Readiness on `/api/status` deferred until that route ships.
- **PVC without `storageClassName`**: cluster default everywhere; the Talos no-default case is a
  documented one-line patch, not a fork of the manifests.
- **Tag pinned in `kustomization.yaml`**: reproducible rollouts, standard Kustomize override idiom
  for users who want to track differently.
- **CI = build + schema validation only** (no kind-in-CI) for v1; kind stays local/on-demand.
- **Smoke-test-first as the TDD translation**: the harness is the failing test; manifests are the
  implementation that turns it green.
- **Read-only assertion** (found during implementation): `GET /config/dashboard.yaml` returns 404
  before any save, because nginx aliases the PVC path to a file that does not exist yet and the
  app serves its built-in defaults when that load fails. The smoke script therefore tolerates any
  sub-500 status there and proves the read-only contract through the `POST /api/config` 401
  instead, rather than asserting a 200 that only exists after a write.
