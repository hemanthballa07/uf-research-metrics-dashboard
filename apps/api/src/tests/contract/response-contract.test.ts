// Fires every route in the table through an OpenAPI-response-validating app.
// A schema violation surfaces as a 500 whose body names the offending field,
// so a status mismatch is self-explaining.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import {
  buildValidatedApp,
  routeTable,
  seedContractFixtures,
  cleanupContractUsers,
  type Fixtures,
} from './harness.js';
import { getAuthToken, getViewerToken, setupTestDatabase, cleanupTestDatabase } from '../setup.js';

const app = buildValidatedApp();

describe('response contract', () => {
  let admin: string;
  let viewer: string;
  let fx: Fixtures;

  beforeAll(async () => {
    await setupTestDatabase();
    admin = await getAuthToken();
    viewer = await getViewerToken();
    fx = await seedContractFixtures();
  });

  afterAll(async () => {
    await cleanupContractUsers();
    await cleanupTestDatabase();
  });

  for (const rc of routeTable) {
    it(`${rc.method.toUpperCase()} ${rc.name}`, async () => {
      let token: string | undefined;
      if (rc.auth === 'admin') token = admin;
      else if (rc.auth === 'viewer') token = viewer;
      else if (rc.auth === 'freshAdmin') token = await getAuthToken();

      let req = request(app)[rc.method](rc.url(fx));
      if (token) req = req.set('Authorization', `Bearer ${token}`);
      if (rc.contentType) req = req.set('Content-Type', rc.contentType);
      const res = rc.body ? await req.send(rc.body(fx) as never) : await req;

      if (res.status !== rc.expectStatus) {
        // eslint-disable-next-line no-console
        console.error(
          `[contract:${rc.name}] expected ${rc.expectStatus} got ${res.status}:`,
          JSON.stringify(res.body),
        );
      }
      expect(res.status).toBe(rc.expectStatus);
      if (rc.expectContentType) {
        expect(String(res.headers['content-type'] ?? '')).toContain(rc.expectContentType);
      }
    });
  }
});
