#!/usr/bin/env bash
# Runs the Angular dev server and the config-write-api sidecar together, so `Save` in the
# configurator works without building the Docker image. `proxy.conf.json` (wired into
# angular.json's serve options) forwards /api/* from :4200 to the sidecar on :3000.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# CONFIG_PATH matches yaml-loader.service.ts's dev-mode fetch of /config/dashboard.yaml, which
# Angular serves from public/config/ (see .gitignore) — not the repo-root config/ used by Docker.
CONFIG_WRITE_TOKEN="${CONFIG_WRITE_TOKEN:-dev-token}"
CONFIG_PATH="${CONFIG_PATH:-$(pwd)/public/config/dashboard.yaml}"
PORT="${SERVER_PORT:-3000}"

if [ ! -f "$CONFIG_PATH" ]; then
  echo "error: $CONFIG_PATH does not exist. Copy public/config/dashboard.example.yaml there first." >&2
  exit 1
fi

if [ ! -d server/node_modules ]; then
  echo "Installing server dependencies..."
  npm --prefix server install
fi

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting config-write-api on http://localhost:$PORT (token: $CONFIG_WRITE_TOKEN, writing to $CONFIG_PATH)"
CONFIG_WRITE_TOKEN="$CONFIG_WRITE_TOKEN" CONFIG_PATH="$CONFIG_PATH" PORT="$PORT" \
  npm --prefix server start &

npm start
