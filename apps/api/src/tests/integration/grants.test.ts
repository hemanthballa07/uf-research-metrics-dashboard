import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { getTestPrismaClient, setupTestDatabase, cleanupTestDatabase } from '../setup.js';

const prisma = getTestPrismaClient();

const app = createApp();

describe('GET /api/grants', () => {
  beforeAll(async () => {
    await setupTestDatabase();

    // Seed test data
    const dept = await prisma.department.create({
      data: { name: 'Test Engineering' },
    });

    const faculty = await prisma.faculty.create({
      data: {
        name: 'Dr. Test Faculty',
        email: 'test.faculty@university.edu',
        departmentId: dept.id,
      },
    });

    const sponsor = await prisma.sponsor.create({
      data: {
        name: 'Test Sponsor',
        sponsorType: 'federal',
      },
    });

    await prisma.grant.create({
      data: {
        title: 'Test Grant',
        sponsorId: sponsor.id,
        piId: faculty.id,
        departmentId: dept.id,
        amount: 100000,
        status: 'awarded',
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
      .query({ status: 'awarded', page: 1, pageSize: 10 })
      .expect(200);

    expect(response.body.items.every((grant: { status: string }) => grant.status === 'awarded')).toBe(true);
  });

  it('should search grants by title', async () => {
    const response = await request(app)
      .get('/api/grants')
      .query({ search: 'Test', page: 1, pageSize: 10 })
      .expect(200);

    expect(response.body.items.length).toBeGreaterThan(0);
    expect(
      response.body.items.some((grant: { title: string }) =>
        grant.title.toLowerCase().includes('test')
      )
    ).toBe(true);
  });
});

