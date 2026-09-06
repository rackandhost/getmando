import { buildApp } from './app';

const configWriteToken = process.env['CONFIG_WRITE_TOKEN'];
if (!configWriteToken) {
  console.error('CONFIG_WRITE_TOKEN is required to start the config-write-api sidecar.');
  process.exit(1);
}

const targetPath = process.env['CONFIG_PATH'] ?? '/app/config/dashboard.yaml';
const port = Number(process.env['PORT'] ?? 3000);
const host = process.env['HOST'] ?? '0.0.0.0';

const app = buildApp({ configWriteToken, targetPath });

app
  .listen({ port, host })
  .then(() => {
    console.log(`config-write-api listening on http://${host}:${port}, writing to ${targetPath}`);
  })
  .catch((error: unknown) => {
    console.error('Failed to start config-write-api:', error);
    process.exit(1);
  });
