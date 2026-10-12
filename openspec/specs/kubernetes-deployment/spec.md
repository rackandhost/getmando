# Kubernetes Deployment Specification

## Purpose

Let any homelab Kubernetes user — stock Kubernetes, k3s, or Talos — run Mando from
declarative manifests in the repository with one `kubectl apply -k`, with the same runtime contract
as the Docker deployment: same image, working visual-configurator Save backed by persistent
storage, and the existing `/health` endpoint as the platform's health signal.

## Requirements

### Requirement: Declarative Kustomize base

The repository MUST ship a Kustomize base under `deploy/kubernetes/` containing the Namespace,
PersistentVolumeClaim, Deployment, Service, and Ingress resources, installable with
`kubectl apply -k deploy/kubernetes`. The image reference MUST be overridable through Kustomize
(the `images:` transformer) without editing the Deployment, and the kustomization MUST pin the
image by digest — with the release tag recorded alongside as a comment — rather than reference a
mutable tag such as `latest`.

#### Scenario: Fresh install on a default-configured cluster
- GIVEN a cluster with a default StorageClass and no prior Mando resources
- WHEN `kubectl apply -k deploy/kubernetes` runs
- THEN all resources create successfully and the Deployment's pod reaches `Ready`

#### Scenario: GitOps consumption
- GIVEN a Flux or Argo CD installation pointed at the repository's `deploy/kubernetes/` directory
- WHEN the tooling reconciles
- THEN it applies the same resource set as `kubectl apply -k` without modification

#### Scenario: Pinning or overriding the image
- GIVEN a user who wants a different image version than the pinned digest
- WHEN they set `images: - name: ghcr.io/rackandhost/getmando newTag: <tag>` (or their own digest)
  in their own overlay
- THEN the applied Deployment references their version and no repository file is edited

### Requirement: Config persistence via a PersistentVolumeClaim

The Deployment MUST mount `/app/config` from a PersistentVolumeClaim. The system MUST NOT use a
ConfigMap as the source of `dashboard.yaml`, because the configurator's Save writes to that path.
The PersistentVolumeClaim MUST NOT set `storageClassName` (it MUST use the cluster's default), and
the manifests or README MUST document how to set one explicitly for clusters without a default
StorageClass (vanilla Talos).

#### Scenario: Save survives pod deletion
- GIVEN a dashboard saved through `/configure` with the write token configured
- WHEN the pod is deleted and rescheduled by the Deployment
- THEN the re-created pod serves the previously saved `dashboard.yaml`

#### Scenario: No default StorageClass
- GIVEN a cluster with no default StorageClass (e.g. vanilla Talos)
- WHEN the user follows the documented patch to set `storageClassName` on the claim
- THEN the PVC binds and the pod schedules

### Requirement: Single replica with Recreate strategy

The Deployment MUST declare `replicas: 1` and `strategy.type: Recreate`, because the default
StorageClass volume is `ReadWriteOnce` and cannot attach to a replacement pod while the current
one holds it. The manifests MUST NOT declare an autoscaler.

#### Scenario: Image update does not deadlock
- GIVEN a running single-replica Deployment with a bound RWO volume
- WHEN the image tag is updated and the Deployment applied
- THEN the old pod terminates before the new one is created (no unschedulable overlap)

### Requirement: Write token from an optional Secret

The Deployment MUST source `CONFIG_WRITE_TOKEN` from a Secret via `secretKeyRef`, and that
reference MUST be optional (`optional: true`). The kustomization MUST NOT reference any Secret
resource, so applying the base can never materialize a placeholder or committed token. The
repository MAY ship an example Secret file, but it MUST NOT be part of the applied resource set.

#### Scenario: Read-only deployment without a Secret
- GIVEN the base applied and no `getmando-config-write` Secret in the namespace
- WHEN the pod starts and a browser opens the dashboard
- THEN the dashboard renders from defaults or the existing `dashboard.yaml`
- AND the configurator's Save is rejected (`POST /api/config` responds `401`)

#### Scenario: Write-enabled deployment
- GIVEN the operator created the Secret with key `CONFIG_WRITE_TOKEN`
- WHEN the pod (re)starts and a user saves from `/configure` with that token
- THEN the configuration is written to the PVC-backed `dashboard.yaml`

### Requirement: Health probes on the existing endpoint

The Deployment MUST define liveness and readiness probes as `GET /health` on port 80. The
manifests MUST NOT introduce a new health endpoint or depend on the not-yet-shipped `/api/status`
route (upgrading readiness to that route MAY happen in a later change, once it ships).

#### Scenario: Pod becomes ready when healthy
- GIVEN the applied Deployment on a healthy cluster
- WHEN the container's nginx answers `GET /health` with `200`
- THEN the pod reports `Ready` and the Service endpoints include it

#### Scenario: Unhealthy container is restarted
- GIVEN a running pod whose `/health` stops answering
- WHEN the liveness probe exhausts its failure threshold
- THEN the kubelet restarts the container

### Requirement: Service and Ingress entry points

The base MUST ship a ClusterIP Service exposing port 80, and an Ingress resource with a
placeholder host and a documented ingress class, both overridable by a one-line Kustomize patch
without editing repository files. The base MUST NOT configure TLS or cert-manager.

#### Scenario: Port-forward access
- GIVEN the applied base
- WHEN `kubectl port-forward -n getmando svc/getmando 8080:80` runs
- THEN `http://localhost:8080` serves the dashboard and `/config/dashboard.yaml` returns the
  current configuration

#### Scenario: Ingress host and class are user-adjustable
- GIVEN a k3s cluster whose ingress controller is traefik
- WHEN the user patches `ingressClassName: traefik` and their hostname in an overlay
- THEN the ingress routes their host to the dashboard without any repository edit

### Requirement: CI validation of the manifests

Every pull request MUST be gated by a CI step that builds the kustomization (`kubectl kustomize`)
and validates the output against the upstream Kubernetes OpenAPI schemas (kubeconform). The base
MUST contain no custom resources, so validation MUST be strict with nothing skipped.

#### Scenario: A schema-breaking manifest edit fails CI
- GIVEN a pull request that introduces a misspelled required field in a resource
- WHEN the CI manifest-validation step runs
- THEN the step fails and the pull request is blocked

### Requirement: Local smoke-test harness

The repository MUST ship a kind-based smoke-test script (exposed as an npm script,
`verify:k8s`) that applies the base to a throwaway kind cluster and asserts the runtime contract:
the bundle is served, `/health` answers, `/config/dashboard.yaml` returns the current
configuration, a token-authenticated `POST /api/config` round-trips, and the written configuration
survives pod rescheduling. The script MUST check prerequisites per stage: the structural stage
(kustomize build) MUST require only `kubectl`; the runtime stages MUST additionally require `kind`
and a container runtime. A stage whose prerequisites are missing MUST be skipped with an
explanatory message, and skipped stages MUST NOT fail the run, while a stage that runs and fails
its assertions MUST fail the run. The script MUST therefore never block contributors whose
machines lack container tooling, while machines with partial tooling still get partial
verification.

#### Scenario: Full pass on a machine with kind
- GIVEN a machine with `kubectl`, `kind`, and a container runtime
- WHEN `npm run verify:k8s` runs
- THEN both stages run: it creates a throwaway cluster, applies the base, asserts every contract
  above, and deletes the cluster

#### Scenario: Structural-only pass on a machine with kubectl but no kind
- GIVEN a machine with `kubectl` but no `kind` or container runtime
- WHEN `npm run verify:k8s` runs
- THEN the structural stage runs and can fail on a broken kustomization
- AND the runtime stage prints a skip message and does not run
- AND the script exits `0`, because nothing that ran failed

#### Scenario: Clean skip on a machine without kubectl
- GIVEN a machine without `kubectl`
- WHEN `npm run verify:k8s` runs
- THEN it prints which prerequisite is missing and exits `0` without failing the npm script chain
