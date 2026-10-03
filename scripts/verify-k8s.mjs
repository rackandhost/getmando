#!/usr/bin/env node
// Kubernetes smoke test for the deploy/kubernetes manifests.
//
// Prerequisites are checked per stage, never all up front:
//   Stage A (structural) needs only kubectl; it runs `kubectl kustomize deploy/kubernetes`.
//   Stage B (runtime)   additionally needs kind and a container runtime (docker or podman); it
//                       spins up a throwaway kind cluster, applies the base, and asserts the
//                       runtime contract end to end.
// A stage whose prerequisite is missing prints a skip message and does not run. Skipped stages
// never fail the run; a stage that runs and fails its assertions exits non-zero. Partial tooling
// therefore yields partial verification: a kubectl-only machine still catches a broken
// kustomization, and a machine with no tooling at all skips cleanly without blocking anyone.
//
// Override the binaries with the KUBECTL and KIND environment variables (useful for a
// standalone kubectl that is not on PATH).

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_DIR = path.join(REPO_ROOT, 'deploy', 'kubernetes');

const KUBECTL = process.env.KUBECTL ?? 'kubectl';
const KIND = process.env.KIND ?? 'kind';

const CLUSTER_NAME = 'getmando-smoke';
const NAMESPACE = 'getmando';
const DEPLOYMENT = 'getmando';
const POD_LABEL_SELECTOR = 'app.kubernetes.io/name=getmando';
const SECRET_NAME = 'getmando-config-write';
const WRITE_TOKEN = 'smoke-test';
const LOCAL_PORT = 18080;

const ROLLOUT_TIMEOUT = '180s';
const CLUSTER_WAIT = '120s';
const HTTP_TIMEOUT_MS = 60_000;

const BASE_URL = `http://127.0.0.1:${LOCAL_PORT}`;

// Minimal dashboard that satisfies DashboardConfigSchema: metadata, >=1 category, >=1 application
// (with a valid http url, icon, and category reference), bookmarks, and settings.
const MINIMAL_CONFIG = {
  metadata: { title: 'Smoke Test', description: 'Kubernetes smoke test' },
  categories: [{ id: 'smoke', name: 'Smoke' }],
  applications: [
    {
      id: 'smoke-app',
      name: 'Smoke App',
      description: 'Smoke test application',
      url: 'http://example.com',
      icon: { type: 'initials', value: 'SA' },
      category: 'smoke',
    },
  ],
  bookmarks: [],
  settings: {},
};

function spawnOptions({ env, stdio } = {}) {
  const options = {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, ...env },
  };
  if (stdio !== undefined) {
    options.stdio = stdio;
  }
  return options;
}

function binaryMissing(result) {
  return result.error?.code === 'ENOENT';
}

/** Returns true when the binary can be spawned at all (exit code is irrelevant). */
function binaryExists(command) {
  const result = spawnSync(command, ['--version'], spawnOptions({ stdio: 'ignore' }));
  return !result.error;
}

function detectContainerRuntime() {
  if (binaryExists('docker')) {
    return { label: 'docker', env: {} };
  }
  if (binaryExists('podman')) {
    // kind needs this to use podman instead of docker.
    return { label: 'podman', env: { KIND_EXPERIMENTAL_PROVIDER: 'podman' } };
  }
  return null;
}

function mustRun(command, args, options = {}) {
  const result = spawnSync(command, args, spawnOptions(options));
  if (result.status !== 0) {
    const output = (result.stderr || result.stdout || '').trim();
    throw new Error(`${command} ${args.join(' ')} failed (exit ${result.status}).\n${output}`);
  }
  return result;
}

function runStageA() {
  console.log('Stage A: structural (kubectl kustomize)');
  const result = spawnSync(KUBECTL, ['kustomize', BASE_DIR], spawnOptions({ stdio: 'pipe' }));

  if (binaryMissing(result)) {
    console.log('  skipped: kubectl not found (set KUBECTL to a binary path)');
    return { ran: false, ok: true };
  }
  if (result.status !== 0) {
    console.error('  FAILED: kubectl kustomize deploy/kubernetes');
    console.error((result.stderr || result.stdout || '').trim());
    return { ran: true, ok: false };
  }

  const documents = (result.stdout ?? '')
    .split(/^---$/mu)
    .filter((document) => document.trim().length > 0).length;
  console.log(`  ok: kustomization built (${documents} resource document(s))`);
  return { ran: true, ok: true };
}

let clusterCreated = false;
let portForward = null;

function stopPortForward() {
  if (portForward && portForward.exitCode === null) {
    portForward.kill();
  }
  portForward = null;
}

function startPortForward(runtimeEnv) {
  stopPortForward();
  portForward = spawn(
    KUBECTL,
    ['port-forward', '-n', NAMESPACE, `svc/${DEPLOYMENT}`, `${LOCAL_PORT}:80`],
    spawnOptions({ env: runtimeEnv, stdio: ['ignore', 'ignore', 'ignore'] }),
  );
  portForward.on('exit', () => {
    portForward = null;
  });
}

function teardownCluster(runtimeEnv) {
  stopPortForward();
  if (!clusterCreated) {
    return;
  }
  console.log(`\nTearing down kind cluster "${CLUSTER_NAME}"...`);
  spawnSync(
    KIND,
    ['delete', 'cluster', '--name', CLUSTER_NAME],
    spawnOptions({ env: runtimeEnv, stdio: 'inherit' }),
  );
  clusterCreated = false;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function getJsonOrText(pathname) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  const body = await response.text();
  return { status: response.status, body };
}

async function waitForHttp(pathname, timeoutMs = HTTP_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no attempt made';
  while (Date.now() < deadline) {
    try {
      const { status } = await getJsonOrText(pathname);
      if (status < 500) {
        return;
      }
      lastError = `HTTP ${status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${pathname} via port-forward (${lastError})`);
}

async function postConfig(token) {
  const headers = { 'content-type': 'application/json' };
  if (token) {
    headers['x-config-token'] = token;
  }
  const response = await fetch(`${BASE_URL}/api/config`, {
    method: 'POST',
    headers,
    body: JSON.stringify(MINIMAL_CONFIG),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  return { status: response.status, body: await response.text() };
}

async function runStageB() {
  console.log('\nStage B: runtime (kind + container runtime)');

  const missing = [];
  if (!binaryExists(KUBECTL)) {
    missing.push('kubectl');
  }
  if (!binaryExists(KIND)) {
    missing.push('kind');
  }
  const runtime = detectContainerRuntime();
  if (!runtime) {
    missing.push('docker or podman');
  }
  if (missing.length > 0) {
    console.log(`  skipped: missing ${missing.join(', ')}`);
    return { ran: false, ok: true };
  }

  const runtimeEnv = runtime.env;

  try {
    console.log(`  creating kind cluster "${CLUSTER_NAME}" (provider: ${runtime.label})...`);
    mustRun(KIND, ['create', 'cluster', '--name', CLUSTER_NAME, '--wait', CLUSTER_WAIT], {
      env: runtimeEnv,
      stdio: 'inherit',
    });
    clusterCreated = true;

    console.log('  applying deploy/kubernetes...');
    mustRun(KUBECTL, ['apply', '-k', BASE_DIR], { env: runtimeEnv, stdio: 'inherit' });

    console.log('  waiting for rollout...');
    mustRun(
      KUBECTL,
      ['rollout', 'status', `deployment/${DEPLOYMENT}`, '-n', NAMESPACE, `--timeout=${ROLLOUT_TIMEOUT}`],
      { env: runtimeEnv, stdio: 'inherit' },
    );

    startPortForward(runtimeEnv);
    await waitForHttp('/health');

    const root = await getJsonOrText('/');
    assert(root.status === 200, `GET / returned ${root.status}, expected 200`);
    assert(root.body.includes('Mando Dashboard'), 'GET / did not contain the app shell markup');

    const health = await getJsonOrText('/health');
    assert(health.status === 200, `GET /health returned ${health.status}, expected 200`);
    assert(health.body.includes('healthy'), 'GET /health did not report healthy');

    // Before the write token Secret exists, the config path may 404 (no file saved yet) but must
    // never be a server error — nginx is aliasing it to the mounted PVC path.
    const configBeforeSave = await getJsonOrText('/config/dashboard.yaml');
    assert(
      configBeforeSave.status < 500,
      `GET /config/dashboard.yaml returned ${configBeforeSave.status}, expected < 500`,
    );

    const readOnlyWrite = await postConfig(WRITE_TOKEN);
    assert(
      readOnlyWrite.status === 401,
      `POST /api/config without a configured token returned ${readOnlyWrite.status}, expected 401`,
    );

    console.log('  creating write-token Secret and restarting the deployment...');
    mustRun(
      KUBECTL,
      [
        'create',
        'secret',
        'generic',
        SECRET_NAME,
        `--from-literal=CONFIG_WRITE_TOKEN=${WRITE_TOKEN}`,
        '-n',
        NAMESPACE,
      ],
      { env: runtimeEnv },
    );
    mustRun(KUBECTL, ['rollout', 'restart', `deployment/${DEPLOYMENT}`, '-n', NAMESPACE], {
      env: runtimeEnv,
    });
    mustRun(
      KUBECTL,
      ['rollout', 'status', `deployment/${DEPLOYMENT}`, '-n', NAMESPACE, `--timeout=${ROLLOUT_TIMEOUT}`],
      { env: runtimeEnv, stdio: 'inherit' },
    );
    startPortForward(runtimeEnv);
    await waitForHttp('/health');

    const write = await postConfig(WRITE_TOKEN);
    assert(write.status === 200, `POST /api/config returned ${write.status}, expected 200`);

    const configAfterSave = await getJsonOrText('/config/dashboard.yaml');
    assert(configAfterSave.status === 200, `GET /config/dashboard.yaml returned ${configAfterSave.status}, expected 200`);
    assert(configAfterSave.body.includes('Smoke Test'), 'saved configuration was not served back');

    console.log('  deleting the pod to verify PVC persistence...');
    mustRun(
      KUBECTL,
      ['delete', 'pod', '-n', NAMESPACE, '-l', POD_LABEL_SELECTOR, '--wait=true'],
      { env: runtimeEnv, stdio: 'inherit' },
    );
    mustRun(
      KUBECTL,
      ['rollout', 'status', `deployment/${DEPLOYMENT}`, '-n', NAMESPACE, `--timeout=${ROLLOUT_TIMEOUT}`],
      { env: runtimeEnv, stdio: 'inherit' },
    );
    startPortForward(runtimeEnv);
    await waitForHttp('/health');

    const configAfterReschedule = await getJsonOrText('/config/dashboard.yaml');
    assert(configAfterReschedule.status === 200, `GET /config/dashboard.yaml after reschedule returned ${configAfterReschedule.status}`);
    assert(
      configAfterReschedule.body.includes('Smoke Test'),
      'saved configuration did not survive pod rescheduling (PVC persistence)',
    );

    console.log('  ok: runtime contract verified');
    return { ran: true, ok: true };
  } catch (error) {
    console.error(`  FAILED: ${error instanceof Error ? error.message : String(error)}`);
    return { ran: true, ok: false };
  } finally {
    teardownCluster(runtimeEnv);
  }
}

async function main() {
  console.log('Kubernetes smoke test — stages run only where their prerequisites exist.\n');

  const stageA = runStageA();
  const stageB = await runStageB();

  const failed = (stageA.ran && !stageA.ok) || (stageB.ran && !stageB.ok);
  if (failed) {
    console.error('\nSmoke test FAILED.');
    process.exitCode = 1;
    return;
  }

  console.log('\nSmoke test OK (ran stages passed; missing prerequisites were skipped).');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
