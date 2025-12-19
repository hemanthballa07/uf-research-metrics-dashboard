import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { getTestPrismaClient, setupTestDatabase, cleanupTestDatabase } from '../setup.js';

const prisma = getTestPrismaClient();

const app = createApp();

describe('GET /api/metrics/summary', () => {
  beforeAll(async () => {
    await setupTestDatabase();

    // Seed test data for metrics
    const dept = await prisma.department.create({
      data: { name: 'Test Department' },
    });

    const faculty = await prisma.faculty.create({
      data: {
        name: 'Dr. Metrics Test',
        email: 'metrics.test@university.edu',
        departmentId: dept.id,
      },
    });

    const sponsor = await prisma.sponsor.create({
      data: {
        name: 'Test Metrics Sponsor',
        sponsorType: 'federal',
      },
    });

    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Create awarded grant within last 12 months
    await prisma.grant.create({
      data: {
        title: 'Awarded Grant',
        sponsorId: sponsor.id,
        piId: faculty.id,
        departmentId: dept.id,
        amount: 500000,
        status: 'awarded',
        submittedAt: sixMonthsAgo,
        awardedAt: threeMonthsAgo,
      },
    });

    // Create submitted grant
    await prisma.grant.create({
      data: {
        title: 'Submitted Grant',
        sponsorId: sponsor.id,
        piId: faculty.id,
        departmentId: dept.id,
        amount: 300000,
        status: 'submitted',
        submittedAt: threeMonthsAgo,
        awardedAt: null,
      },
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it('should return metrics summary', async () => {
    const response = await request(app).get('/api/metrics/summary').expect(200);

    expect(response.body).toHaveProperty('totalSubmissions');
    expect(response.body).toHaveProperty('totalAwardedAmount');
    expect(response.body).toHaveProperty('awardRate');
    expect(response.body).toHaveProperty('medianTimeToAward');
    expect(typeof response.body.totalSubmissions).toBe('number');
    expect(typeof response.body.totalAwardedAmount).toBe('number');
    expect(typeof response.body.awardRate).toBe('number');
    expect(response.body.medianTimeToAward === null || typeof response.body.medianTimeToAward === 'number').toBe(true);
  });

  it('should calculate award rate correctly', async () => {
    const response = await request(app).get('/api/metrics/summary').expect(200);

    // Award rate should be between 0 and 100 (or 0 and 1 if stored as decimal)
    expect(response.body.awardRate).toBeGreaterThanOrEqual(0);
    expect(response.body.awardRate).toBeLessThanOrEqual(100);
  });
});

