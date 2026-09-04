import Fastify, { FastifyError, FastifyInstance } from 'fastify';
import { dump } from 'js-yaml';

import { DashboardConfigSchema } from '../../src/app/core/models/dashboard.models';

import { writeConfigAtomically } from './write-config';

export interface AppOptions {
  configWriteToken: string;
  targetPath: string;
  /** Max request body size in bytes. Defaults to 256KB — generous for a dashboard config JSON. */
  bodyLimit?: number;
}

const DEFAULT_BODY_LIMIT = 256 * 1024;

/** Mirrors src/app/core/services/yaml-parser.service.ts's ParseError shape (see design.md). */
interface ParseError {
  path: string[];
  message: string;
  code?: string;
}

const CONFIG_TOKEN_HEADER = 'x-config-token';

/** Builds the sidecar's Fastify instance: a single authenticated POST /api/config route. */
export function buildApp({
  configWriteToken,
  targetPath,
  bodyLimit = DEFAULT_BODY_LIMIT,
}: AppOptions): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit });

  // onRequest runs before Fastify parses the body, so an unauthorized request never has its
  // payload read, per the "before reading or validating its body" requirement.
  app.addHook('onRequest', async (request, reply) => {
    const provided = request.headers[CONFIG_TOKEN_HEADER];
    if (provided !== configWriteToken) {
      await reply.code(401).send({ status: 'unauthorized' });
    }
  });

  // Normalizes Fastify's own body-parsing failures (oversized payload, malformed JSON) into the
  // same response shapes the route handler uses, instead of leaking Fastify's default error format.
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send({ status: 'error', message: error.message });
    }
    if (error.statusCode === 400) {
      return reply
        .code(400)
        .send({ status: 'invalid', errors: [{ path: [], message: error.message }] });
    }
    return reply
      .code(error.statusCode ?? 500)
      .send({ status: 'error', message: error.message });
  });

  app.post('/api/config', async (request, reply) => {
    const result = DashboardConfigSchema.safeParse(request.body);
    if (!result.success) {
      const errors: ParseError[] = result.error.issues.map((issue) => ({
        path: issue.path.map(String),
        message: issue.message,
        code: issue.code,
      }));
      return reply.code(400).send({ status: 'invalid', errors });
    }

    const yamlContent = dump(result.data, { lineWidth: -1, noRefs: true, sortKeys: false });

    try {
      await writeConfigAtomically(targetPath, yamlContent);
    } catch (error) {
      return reply.code(500).send({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return reply.code(200).send({ status: 'saved' });
  });

  return app;
}
