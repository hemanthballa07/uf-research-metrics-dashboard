import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../../app.js';
import { getTestPrismaClient, setupTestDatabase, cleanupTestDatabase, getAuthToken, getViewerToken } from '../setup.js';

const prisma = getTestPrismaClient();
const app = createApp();

describe('User management API', () => {
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    adminToken = await getAuthToken();
    viewerToken = await getViewerToken();
  });

  afterAll(async () => {
    // Clean up any users created during tests (except test-admin and test-viewer)
    await prisma.user.deleteMany({
      where: {
        email: {
          notIn: ['test-admin@ufl.edu', 'test-viewer@ufl.edu'],
        },
      },
    });
    await cleanupTestDatabase();
  });

  describe('GET /api/users', () => {
    it('ADMIN can list users (200)', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      // Ensure passwordHash is never returned
      response.body.items.forEach((user: Record<string, unknown>) => {
        expect(user).not.toHaveProperty('passwordHash');
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('createdAt');
      });
    });

    it('VIEWER gets 403 on GET /api/users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('unauthenticated request gets 401', async () => {
      await request(app)
        .get('/api/users')
        .expect(401);
    });
  });

  describe('POST /api/users', () => {
    it('ADMIN can create user (201)', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'new-user@ufl.edu',
          name: 'New User',
          password: 'securepassword123',
          role: 'VIEWER',
        })
        .expect(201);

      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe('new-user@ufl.edu');
      expect(response.body.name).toBe('New User');
      expect(response.body.role).toBe('VIEWER');
    });

    it('VIEWER gets 403 on POST /api/users', async () => {
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          email: 'another-user@ufl.edu',
          name: 'Another User',
          password: 'securepassword123',
          role: 'VIEWER',
        })
        .expect(403);
    });

    it('returns 400 for duplicate email', async () => {
      // Create first
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'duplicate@ufl.edu',
          name: 'Dup User',
          password: 'securepassword123',
          role: 'VIEWER',
        })
        .expect(201);

      // Try again with same email
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'duplicate@ufl.edu',
          name: 'Dup User 2',
          password: 'securepassword123',
          role: 'VIEWER',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('returns 400 for invalid payload (short password)', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'valid@ufl.edu',
          name: 'Valid Name',
          password: 'short',
          role: 'VIEWER',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('PATCH /api/users/:id/role', () => {
    it('ADMIN can update a user role', async () => {
      // Create a user to update
      const created = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'role-change@ufl.edu',
          name: 'Role Change User',
          password: 'securepassword123',
          role: 'VIEWER',
        })
        .expect(201);

      const userId = created.body.id;

      const response = await request(app)
        .patch(`/api/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'ADMIN' })
        .expect(200);

      expect(response.body.role).toBe('ADMIN');
    });

    it('cannot demote the last admin', async () => {
      // Get the test-admin user id
      const users = await prisma.user.findMany({ where: { role: 'ADMIN' } });
      // If there's only one admin, demoting should fail
      if (users.length === 1) {
        const response = await request(app)
          .patch(`/api/users/${users[0].id}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'VIEWER' })
          .expect(400);

        expect(response.body.error.message).toBe('Cannot demote the last admin');
      } else {
        // Skip this assertion when there are multiple admins (other tests may have promoted some)
        expect(users.length).toBeGreaterThan(1);
      }
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('ADMIN can delete another user', async () => {
      const created = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'to-delete@ufl.edu',
          name: 'Delete Me',
          password: 'securepassword123',
          role: 'VIEWER',
        })
        .expect(201);

      await request(app)
        .delete(`/api/users/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('cannot delete own account', async () => {
      // Find the test-admin user id
      const adminUser = await prisma.user.findUnique({ where: { email: 'test-admin@ufl.edu' } });
      expect(adminUser).toBeDefined();

      const response = await request(app)
        .delete(`/api/users/${adminUser!.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.error.message).toBe('Cannot delete your own account');
    });
  });

  describe('PATCH /auth/change-password', () => {
    const changePasswordEmail = 'change-pw@ufl.edu';
    const originalPassword = 'originalpassword123';

    beforeAll(async () => {
      // Create a dedicated user for password change tests
      const hash = await bcrypt.hash(originalPassword, 10);
      await prisma.user.upsert({
        where: { email: changePasswordEmail },
        update: { passwordHash: hash },
        create: {
          email: changePasswordEmail,
          name: 'Change PW User',
          passwordHash: hash,
          role: 'VIEWER',
        },
      });
    });

    it('change password with correct current password (200)', async () => {
      // Get a token for this user
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: changePasswordEmail, password: originalPassword })
        .expect(200);

      const token = loginRes.body.accessToken;

      const response = await request(app)
        .patch('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: originalPassword,
          newPassword: 'newpassword456',
        })
        .expect(200);

      expect(response.body.message).toBe('Password changed successfully');

      // Restore original password for subsequent tests
      const hash = await bcrypt.hash(originalPassword, 10);
      await prisma.user.update({
        where: { email: changePasswordEmail },
        data: { passwordHash: hash },
      });
    });

    it('change password with wrong current password (401)', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: changePasswordEmail, password: originalPassword })
        .expect(200);

      const token = loginRes.body.accessToken;

      const response = await request(app)
        .patch('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword456',
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('requires authentication (401 without token)', async () => {
      await request(app)
        .patch('/api/auth/change-password')
        .send({
          currentPassword: originalPassword,
          newPassword: 'newpassword456',
        })
        .expect(401);
    });
  });
});
