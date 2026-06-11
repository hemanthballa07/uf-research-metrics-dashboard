// Asserts live 400/401/403/404 bodies match the shared error envelope, and that
// the spec documents those error responses via the ErrorResponse component.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { errorEnvelopeSchema } from '@uf-research-metrics-platform/shared';
import { createApp } from '../../app.js';
import { spec } from './harness.js';
import { getAuthToken, getViewerToken, setupTestDatabase, cleanupTestDatabase } from '../setup.js';

const app = createApp();

describe('error envelope contract', () => {
  let admin: string;
  let viewer: string;

  beforeAll(async () => {
    await setupTestDatabase();
    admin = await getAuthToken();
    viewer = await getViewerToken();
  });
  afterAll(async () => {
    await cleanupTestDatabase();
  });

  const expectEnvelope = (body: unknown) => {
    const parsed = errorEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error('Response is not an error envelope: ' + JSON.stringify(body));
    }
    expect(parsed.success).toBe(true);
  };

  it('401 — missing token', async () => {
    const res = await request(app).get('/api/grants');
    expect(res.status).toBe(401);
    expectEnvelope(res.body);
  });

  it('403 — viewer on an ADMIN route', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${viewer}`);
    expect(res.status).toBe(403);
    expectEnvelope(res.body);
  });

  it('404 — missing grant', async () => {
    const res = await request(app)
      .get('/api/grants/999999')
      .set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(404);
    expectEnvelope(res.body);
  });

  it('400 — invalid request body', async () => {
    const res = await request(app)
      .post('/api/ask')
      .set('Authorization', `Bearer ${admin}`)
      .send({ question: '' });
    expect(res.status).toBe(400);
    expectEnvelope(res.body);
  });

  it('documents error responses with the shared ErrorResponse schema', () => {
    const ref = '#/components/schemas/ErrorResponse';
    const checks: Array<[string, string, string]> = [
      ['/api/grants', 'get', '401'],
      ['/api/users', 'get', '403'],
      ['/api/grants/{id}', 'get', '404'],
      ['/api/ask', 'post', '400'],
    ];
    for (const [path, method, code] of checks) {
      const responses = spec.paths[path][method].responses as Record<
        string,
        { content?: Record<string, { schema?: { $ref?: string } }> }
      >;
      expect(responses[code]?.content?.['application/json']?.schema?.$ref).toBe(ref);
    }
  });
});
