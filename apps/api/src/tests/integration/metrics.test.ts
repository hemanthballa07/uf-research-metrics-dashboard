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

describe('GET /api/metrics/timeseries', () => {
  beforeAll(async () => {
    await setupTestDatabase();

    // Seed test data for timeseries
    const dept = await prisma.department.create({
      data: { name: 'Test Department' },
    });

    const faculty = await prisma.faculty.create({
      data: {
        name: 'Dr. TimeSeries Test',
        email: 'timeseries.test@university.edu',
        departmentId: dept.id,
      },
    });

    const sponsor = await prisma.sponsor.create({
      data: {
        name: 'Test Sponsor',
        sponsorType: 'federal',
      },
    });

    const now = new Date();
    
    // Create grants across different months
    const months = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
    for (const monthOffset of months) {
      const grantDate = new Date(now);
      grantDate.setMonth(grantDate.getMonth() - monthOffset);
      
      // Create submitted grant
      await prisma.grant.create({
        data: {
          title: `Grant ${monthOffset}`,
          sponsorId: sponsor.id,
          piId: faculty.id,
          departmentId: dept.id,
          amount: 100000 + monthOffset * 10000,
          status: 'submitted',
          submittedAt: grantDate,
          awardedAt: null,
        },
      });

      // Create awarded grant (awarded 1 month after submission)
      const awardedDate = new Date(grantDate);
      awardedDate.setMonth(awardedDate.getMonth() + 1);
      await prisma.grant.create({
        data: {
          title: `Awarded Grant ${monthOffset}`,
          sponsorId: sponsor.id,
          piId: faculty.id,
          departmentId: dept.id,
          amount: 200000 + monthOffset * 20000,
          status: 'awarded',
          submittedAt: grantDate,
          awardedAt: awardedDate,
        },
      });
    }
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it('should return 12 rows for default months parameter', async () => {
    const response = await request(app).get('/api/metrics/timeseries').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(12);
  });

  it('should return rows sorted ascending by month', async () => {
    const response = await request(app).get('/api/metrics/timeseries').expect(200);

    const months = response.body.map((row: { month: string }) => row.month);
    const sortedMonths = [...months].sort();
    
    expect(months).toEqual(sortedMonths);
  });

  it('should have numeric fields that are non-negative', async () => {
    const response = await request(app).get('/api/metrics/timeseries').expect(200);

    response.body.forEach((row: { submissions: number; awards: number; awardedAmount: number }) => {
      expect(typeof row.submissions).toBe('number');
      expect(typeof row.awards).toBe('number');
      expect(typeof row.awardedAmount).toBe('number');
      expect(row.submissions).toBeGreaterThanOrEqual(0);
      expect(row.awards).toBeGreaterThanOrEqual(0);
      expect(row.awardedAmount).toBeGreaterThanOrEqual(0);
    });
  });

  it('should respect months query parameter', async () => {
    const response = await request(app).get('/api/metrics/timeseries?months=6').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(6);
  });
});

