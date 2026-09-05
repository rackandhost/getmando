import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { load } from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from './app';

const token = 'secret-token';

const validConfig = {
  metadata: { title: 'Mando', description: 'My Selfhosted Applications' },
  categories: [{ id: 'homelab', name: 'Homelab' }],
  applications: [
    {
      id: 'app1',
      name: 'App One',
      description: 'An app',
      url: 'https://example.com',
      icon: { type: 'name', value: 'app' },
      category: 'homelab',
    },
  ],
  bookmarks: [],
  settings: {},
};

describe('POST /api/config — token auth', () => {
  let dir: string;
  let targetPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'config-write-api-'));
    targetPath = join(dir, 'dashboard.yaml');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects a request with no token header, without reaching the route handler', async () => {
    const app = buildApp({ configWriteToken: token, targetPath });

    const response = await app.inject({ method: 'POST', url: '/api/config', payload: validConfig });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ status: 'unauthorized' });
  });

  it('rejects a request with an incorrect token', async () => {
    const app = buildApp({ configWriteToken: token, targetPath });

    const response = await app.inject({
      method: 'POST',
      url: '/api/config',
      headers: { 'x-config-token': 'wrong' },
      payload: validConfig,
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /api/config — schema validation and write', () => {
  let dir: string;
  let targetPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'config-write-api-'));
    targetPath = join(dir, 'dashboard.yaml');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('accepts a valid config, writes it as YAML, and reports saved', async () => {
    const app = buildApp({ configWriteToken: token, targetPath });

    const response = await app.inject({
      method: 'POST',
      url: '/api/config',
      headers: { 'x-config-token': token },
      payload: validConfig,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'saved' });

    const written = load(await readFile(targetPath, 'utf8'));
    expect(written).toMatchObject({
      metadata: validConfig.metadata,
      applications: [expect.objectContaining({ id: 'app1', category: 'homelab' })],
    });
  });

  it('omits a blank background image override instead of writing it verbatim', async () => {
    const app = buildApp({ configWriteToken: token, targetPath });
    const configWithBlankBackground = {
      ...validConfig,
      settings: { lightBackgroundImage: '', darkBackgroundImage: '   ' },
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/config',
      headers: { 'x-config-token': token },
      payload: configWithBlankBackground,
    });

    expect(response.statusCode).toBe(200);
    const written = load(await readFile(targetPath, 'utf8')) as { settings: object };
    expect(written.settings).not.toHaveProperty('lightBackgroundImage');
    expect(written.settings).not.toHaveProperty('darkBackgroundImage');
  });

  it('keeps a non-blank background image override', async () => {
    const app = buildApp({ configWriteToken: token, targetPath });
    const configWithCustomBackground = {
      ...validConfig,
      settings: { lightBackgroundImage: 'custom-light.jpg' },
    };

    await app.inject({
      method: 'POST',
      url: '/api/config',
      headers: { 'x-config-token': token },
      payload: configWithCustomBackground,
    });

    const written = load(await readFile(targetPath, 'utf8')) as {
      settings: { lightBackgroundImage: string };
    };
    expect(written.settings.lightBackgroundImage).toBe('custom-light.jpg');
  });

  it('rejects a semantically invalid config (dangling category reference) and writes nothing', async () => {
    const app = buildApp({ configWriteToken: token, targetPath });
    const invalidConfig = {
      ...validConfig,
      applications: [{ ...validConfig.applications[0], category: 'ghost' }],
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/config',
      headers: { 'x-config-token': token },
      payload: invalidConfig,
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.status).toBe('invalid');
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['applications', '0', 'category'],
          message: expect.stringContaining("'ghost' does not exist"),
        }),
      ]),
    );
    await expect(readFile(targetPath, 'utf8')).rejects.toThrow(/ENOENT/);
  });

  it('rejects a structurally invalid config (missing required field) and writes nothing', async () => {
    const app = buildApp({ configWriteToken: token, targetPath });
    const { metadata: _metadata, ...withoutMetadata } = validConfig;

    const response = await app.inject({
      method: 'POST',
      url: '/api/config',
      headers: { 'x-config-token': token },
      payload: withoutMetadata,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().status).toBe('invalid');
    await expect(readFile(targetPath, 'utf8')).rejects.toThrow(/ENOENT/);
  });

  it('leaves an existing file untouched when the new payload is invalid', async () => {
    await writeFile(targetPath, 'metadata:\n  title: Existing\n', 'utf8');
    const app = buildApp({ configWriteToken: token, targetPath });
    const invalidConfig = {
      ...validConfig,
      applications: [{ ...validConfig.applications[0], category: 'ghost' }],
    };

    await app.inject({
      method: 'POST',
      url: '/api/config',
      headers: { 'x-config-token': token },
      payload: invalidConfig,
    });

    await expect(readFile(targetPath, 'utf8')).resolves.toBe('metadata:\n  title: Existing\n');
  });
});

describe('POST /api/config — body size limit and malformed JSON', () => {
  let dir: string;
  let targetPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'config-write-api-'));
    targetPath = join(dir, 'dashboard.yaml');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects a body over the configured limit before parsing, and writes nothing', async () => {
    const app = buildApp({ configWriteToken: token, targetPath, bodyLimit: 64 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/config',
      headers: { 'x-config-token': token },
      payload: validConfig,
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({ status: 'error', message: expect.any(String) });
    await expect(readFile(targetPath, 'utf8')).rejects.toThrow(/ENOENT/);
  });

  it('rejects a malformed JSON body with a 400 in the standard error shape', async () => {
    const app = buildApp({ configWriteToken: token, targetPath });

    const response = await app.inject({
      method: 'POST',
      url: '/api/config',
      headers: { 'x-config-token': token, 'content-type': 'application/json' },
      payload: '{ not valid json',
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.status).toBe('invalid');
    expect(body.errors).toEqual([expect.objectContaining({ path: [] })]);
    await expect(readFile(targetPath, 'utf8')).rejects.toThrow(/ENOENT/);
  });
});
