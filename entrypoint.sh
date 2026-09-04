#!/bin/sh
# tini (PID 1) execs this script, which starts the config-write-api sidecar in the background and
# then execs nginx as the container's foreground process. tini reaps/forwards signals for both.
set -e

PORT=3000 node /app/server/index.mjs &

exec nginx -g 'daemon off;'
