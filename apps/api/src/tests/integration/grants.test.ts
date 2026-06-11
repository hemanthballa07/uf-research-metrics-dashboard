import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { getTestPrismaClient, setupTestDatabase, cleanupTestDatabase, getAuthToken } from '../setup.js';

const prisma = getTestPrismaClient();

const app = createApp();

describe('GET /api/grants', () => {
  let token: string;

  beforeAll(async () => {
    await setupTestDatabase();
    token = await getAuthToken();

    // Seed test data
    const dept = await prisma.department.upsert({
      where: { name: 'Test Engineering' },
      update: {},
      create: { name: 'Test Engineering' },
    });

    const faculty = await prisma.faculty.upsert({
      where: { email: 'test.faculty@university.edu' },
      update: { name: 'Dr. Test Faculty', departmentId: dept.id },
      create: { name: 'Dr. Test Faculty', email: 'test.faculty@university.edu', departmentId: dept.id },
    });

    const sponsor = await prisma.sponsor.upsert({
      where: { name_sponsorType: { name: 'Test Sponsor', sponsorType: 'FEDERAL' } },
      update: {},
      create: { name: 'Test Sponsor', sponsorType: 'FEDERAL' },
    });

    await prisma.grant.upsert({
      where: { grantNumber: 'TST-GRANT-0001' },
      update: {},
      create: {
        grantNumber: 'TST-GRANT-0001',
        title: 'Test Grant',
        sponsorId: sponsor.id,
        piId: faculty.id,
        departmentId: dept.id,
        amount: 100000,
        status: 'AWARDED',
        submittedAt: new Date('2024-01-01'),
        awardedAt: new Date('2024-03-01'),
      },
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it('should return paginated grants', async () => {
    const response = await request(app)
      .get('/api/grants')
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 1, pageSize: 10 })
      .expect(200);

    expect(response.body).toHaveProperty('items');
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('page', 1);
    expect(response.body).toHaveProperty('pageSize', 10);
    expect(Array.isArray(response.body.items)).toBe(true);
  });

  it('should filter grants by status', async () => {
    const response = await request(app)
      .get('/api/grants')
      .set('Authorization', `Bearer ${token}`)
      .query({ status: 'AWARDED', page: 1, pageSize: 10 })
      .expect(200);

    expect(response.body.items.every((grant: { status: string }) => grant.status === 'AWARDED')).toBe(true);
  });

  it('should search grants by title or PI name', async () => {
    const response = await request(app)
      .get('/api/grants')
      .set('Authorization', `Bearer ${token}`)
      .query({ search: 'Test', page: 1, pageSize: 10 })
      .expect(200);

    expect(response.body.items.length).toBeGreaterThan(0);
    // The API filters on title OR pi.name (case-insensitive), so assert the
    // actual contract: every returned row matches the term in one of those two
    // fields. Asserting only `title` is brittle when other suites seed PIs
    // whose names contain the term.
    expect(
      response.body.items.every((grant: { title: string; pi?: { name?: string } }) => {
        const term = 'test';
        const title = grant.title?.toLowerCase() ?? '';
        const piName = (grant.pi?.name ?? '').toLowerCase();
        return title.includes(term) || piName.includes(term);
      })
    ).toBe(true);
  });
});
