import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { getTestPrismaClient, setupTestDatabase, cleanupTestDatabase, getAuthToken } from '../setup.js';

const prisma = getTestPrismaClient();

const app = createApp();

describe('GET /api/insights', () => {
  let token: string;

  beforeAll(async () => {
    await setupTestDatabase();
    token = await getAuthToken();

    const dept1 = await prisma.department.upsert({
      where: { name: 'Computer Science' },
      update: {},
      create: { name: 'Computer Science' },
    });

    const dept2 = await prisma.department.upsert({
      where: { name: 'Biology' },
      update: {},
      create: { name: 'Biology' },
    });

    const faculty1 = await prisma.faculty.upsert({
      where: { email: 'test1@university.edu' },
      update: { name: 'Dr. Test Faculty 1', departmentId: dept1.id },
      create: { name: 'Dr. Test Faculty 1', email: 'test1@university.edu', departmentId: dept1.id },
    });

    const faculty2 = await prisma.faculty.upsert({
      where: { email: 'test2@university.edu' },
      update: { name: 'Dr. Test Faculty 2', departmentId: dept2.id },
      create: { name: 'Dr. Test Faculty 2', email: 'test2@university.edu', departmentId: dept2.id },
    });

    const sponsor1 = await prisma.sponsor.upsert({
      where: { name_sponsorType: { name: 'NSF', sponsorType: 'FEDERAL' } },
      update: {},
      create: { name: 'NSF', sponsorType: 'FEDERAL' },
    });

    const sponsor2 = await prisma.sponsor.upsert({
      where: { name_sponsorType: { name: 'NIH', sponsorType: 'FEDERAL' } },
      update: {},
      create: { name: 'NIH', sponsorType: 'FEDERAL' },
    });

    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    let insSeq = 0;
    const upsertGrant = (title: string, piId: number, data: object) => {
      const grantNumber = `INS-TEST-${String(++insSeq).padStart(2, '0')}`;
      return prisma.grant.upsert({
        where: { grantNumber },
        update: data,
        create: { grantNumber, title, piId, ...data },
      });
    };

    await upsertGrant('Awarded Grant 1', faculty1.id, {
      sponsorId: sponsor1.id, departmentId: dept1.id, amount: 500000,
      status: 'AWARDED', submittedAt: sixMonthsAgo, awardedAt: threeMonthsAgo,
    });

    await upsertGrant('Submitted Grant', faculty1.id, {
      sponsorId: sponsor1.id, departmentId: dept1.id, amount: 300000,
      status: 'SUBMITTED', submittedAt: threeMonthsAgo, awardedAt: null,
    });

    await upsertGrant('Under Review Grant', faculty2.id, {
      sponsorId: sponsor2.id, departmentId: dept2.id, amount: 200000,
      status: 'UNDER_REVIEW', submittedAt: threeMonthsAgo, awardedAt: null,
    });

    await upsertGrant('Awarded Grant 2', faculty2.id, {
      sponsorId: sponsor2.id, departmentId: dept2.id, amount: 400000,
      status: 'AWARDED', submittedAt: sixMonthsAgo, awardedAt: threeMonthsAgo,
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it('should return insights data with expected structure', async () => {
    const response = await request(app)
      .get('/api/insights?months=12')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveProperty('summary');
    expect(response.body).toHaveProperty('timeseries');
    expect(response.body).toHaveProperty('dailyActivity');
    expect(response.body).toHaveProperty('sponsorBreakdown');
    expect(response.body).toHaveProperty('departmentBreakdown');
    expect(response.body).toHaveProperty('funnel');
  });

  it('should return 12 months of timeseries data by default', async () => {
    const response = await request(app)
      .get('/api/insights?months=12')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body.timeseries)).toBe(true);
    expect(response.body.timeseries).toHaveLength(12);
  });

  it('should return summary with correct KPI fields', async () => {
    const response = await request(app)
      .get('/api/insights?months=12')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const summary = response.body.summary;
    expect(summary).toHaveProperty('submissions');
    expect(summary).toHaveProperty('awards');
    expect(summary).toHaveProperty('awardRate');
    expect(summary).toHaveProperty('totalAwardedAmount');
    expect(summary).toHaveProperty('medianTimeToAward');
    expect(summary).toHaveProperty('avgAwardSize');

    expect(typeof summary.submissions).toBe('number');
    expect(typeof summary.awards).toBe('number');
    expect(typeof summary.awardRate).toBe('number');
    expect(typeof summary.totalAwardedAmount).toBe('number');
    expect(typeof summary.avgAwardSize).toBe('number');
    expect(summary.medianTimeToAward === null || typeof summary.medianTimeToAward === 'number').toBe(true);
  });

  it('should filter by departmentId when provided', async () => {
    const departments = await prisma.department.findMany();
    const dept1 = departments.find((d) => d.name === 'Computer Science');

    if (!dept1) {
      throw new Error('Test department not found');
    }

    const allResponse = await request(app)
      .get('/api/insights?months=12')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const filteredResponse = await request(app)
      .get(`/api/insights?months=12&departmentId=${dept1.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(filteredResponse.body.summary.submissions).toBeLessThanOrEqual(allResponse.body.summary.submissions);
    expect(filteredResponse.body.departmentBreakdown.length).toBeLessThanOrEqual(allResponse.body.departmentBreakdown.length);
  });

  it('should filter by sponsorType when provided', async () => {
    const allResponse = await request(app)
      .get('/api/insights?months=12')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const filteredResponse = await request(app)
      .get('/api/insights?months=12&sponsorType=federal')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(filteredResponse.body.sponsorBreakdown.length).toBeLessThanOrEqual(allResponse.body.sponsorBreakdown.length);
    filteredResponse.body.sponsorBreakdown.forEach((sponsor: { sponsorType: string | null }) => {
      expect(sponsor.sponsorType).toBe('federal');
    });
  });

  it('should return timeseries with status counts', async () => {
    const response = await request(app)
      .get('/api/insights?months=12')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.timeseries.length).toBeGreaterThan(0);
    response.body.timeseries.forEach((point: {
      month: string;
      submissions: number;
      awards: number;
      awardedAmount: number;
      statusCounts: {
        draft: number;
        submitted: number;
        under_review: number;
        awarded: number;
        declined: number;
      };
    }) => {
      expect(point).toHaveProperty('month');
      expect(point).toHaveProperty('statusCounts');
      expect(point.statusCounts).toHaveProperty('draft');
      expect(point.statusCounts).toHaveProperty('submitted');
      expect(point.statusCounts).toHaveProperty('under_review');
      expect(point.statusCounts).toHaveProperty('awarded');
      expect(point.statusCounts).toHaveProperty('declined');
    });
  });

  it('should return funnel data with all status fields', async () => {
    const response = await request(app)
      .get('/api/insights?months=12')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const funnel = response.body.funnel;
    expect(funnel).toHaveProperty('submitted');
    expect(funnel).toHaveProperty('underReview');
    expect(funnel).toHaveProperty('awarded');
    expect(funnel).toHaveProperty('declined');

    expect(typeof funnel.submitted).toBe('number');
    expect(typeof funnel.underReview).toBe('number');
    expect(typeof funnel.awarded).toBe('number');
    expect(typeof funnel.declined).toBe('number');
  });

  it('should validate months parameter range', async () => {
    await request(app).get('/api/insights?months=0').set('Authorization', `Bearer ${token}`).expect(400);
    await request(app).get('/api/insights?months=37').set('Authorization', `Bearer ${token}`).expect(400);
    await request(app).get('/api/insights?months=12').set('Authorization', `Bearer ${token}`).expect(200);
  });
});
