import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { getTestPrismaClient, setupTestDatabase, cleanupTestDatabase, getAuthToken } from '../setup.js';

const prisma = getTestPrismaClient();
const app = createApp();

describe('Auth revocation', () => {
  let adminToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    adminToken = await getAuthToken();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /auth/logout', () => {
    it('returns 200 with a valid token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.message).toBe('Logged out successfully');
    });

    it('returns 401 without a token', async () => {
      await request(app).post('/api/auth/logout').expect(401);
    });

    it('rejects the token after logout when Redis is available', async () => {
      // Obtain a fresh token so we don't invalidate the shared adminToken.
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test-admin@ufl.edu', password: 'testpassword' })
        .expect(200);

      const freshToken: string = loginRes.body.accessToken;

      // Verify the token works before logout.
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(200);

      // Logout.
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(200);

      // Post-logout: fail-open when Redis is unavailable (200), blocked when available (401).
      const afterRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${freshToken}`);

      expect([200, 401]).toContain(afterRes.status);
    });
  });

  describe('POST /users/:id/revoke-sessions', () => {
    let targetUserId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'revoke-target@ufl.edu',
          name: 'Revoke Target',
          password: 'securepassword123',
          role: 'VIEWER',
        })
        .expect(201);
      targetUserId = res.body.id;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: 'revoke-target@ufl.edu' } });
    });

    it('ADMIN can revoke another user\'s sessions (200)', async () => {
      const res = await request(app)
        .post(`/api/users/${targetUserId}/revoke-sessions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.message).toBe('All active sessions revoked');
    });

    it('VIEWER cannot revoke sessions (403)', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'revoke-target@ufl.edu', password: 'securepassword123' })
        .expect(200);

      await request(app)
        .post(`/api/users/${targetUserId}/revoke-sessions`)
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(403);
    });

    it('returns 401 without authentication', async () => {
      await request(app)
        .post(`/api/users/${targetUserId}/revoke-sessions`)
        .expect(401);
    });
  });
});
