# Dockerfile for Dashboard App v2.1
# Multi-stage build for optimized image size and YAML volume support

# Build stage — Angular app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application for production
RUN npm run build -- --configuration production

# Build stage — config-write-api sidecar
# Bundles server/src into a single ESM file with esbuild, inlining the local dashboard.models.ts
# import (see server/tsconfig.json) while leaving npm packages (fastify, js-yaml, zod) external, so
# they're resolved from node_modules at runtime instead of being bundled (avoids esbuild trying to
# statically analyze fastify's dependency tree, e.g. pino's dynamic transport loading).
FROM node:20-alpine AS server-builder

WORKDIR /server

COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
# The sidecar imports this file directly (see design.md) rather than duplicating the schema; the
# relative import path in server/src/app.ts expects it at /src/... one level above /server.
COPY src/app/core/models/dashboard.models.ts /src/app/core/models/dashboard.models.ts

RUN npm run build
# Drop devDependencies (typescript, vitest, esbuild, tsx, @types/*) now that the bundle exists —
# only the production deps the bundle imports at runtime need to ship.
RUN npm prune --omit=dev

# Production stage
FROM nginx:alpine

# Install basic tools for debugging, plus the Node runtime and tini for the write-api sidecar
RUN apk add --no-cache curl nodejs tini

# Create directory for mounted config
RUN mkdir -p /app/config

# Copy built assets from builder
COPY --from=builder /app/dist/getmando/browser /usr/share/nginx/html

# Copy the write-api sidecar bundle and its production dependencies
COPY --from=server-builder /server/dist/index.mjs /app/server/index.mjs
COPY --from=server-builder /server/node_modules /app/node_modules

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Starts the sidecar in the background, then execs nginx as the foreground process
COPY entrypoint.sh /entrypoint.sh

# Ensure proper permissions
RUN chmod -R 755 /usr/share/nginx/html && \
    chmod -R 755 /app/config && \
    chmod +x /entrypoint.sh

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# tini (PID 1) forwards signals and reaps zombies for both nginx and the sidecar process
ENTRYPOINT ["tini", "--", "/entrypoint.sh"]
