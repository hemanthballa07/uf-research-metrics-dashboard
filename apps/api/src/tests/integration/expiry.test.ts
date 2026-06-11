import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { getTestPrismaClient, setupTestDatabase, cleanupTestDatabase, getAuthToken } from '../setup.js';

const prisma = getTestPrismaClient();
const app = createApp();

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

describe('GET /api/grants/expiring', () => {
  let token: string;

  beforeAll(async () => {
    await setupTestDatabase();
    token = await getAuthToken();

    const dept = await prisma.department.upsert({
      where: { name: 'Expiry Test Dept' },
      update: {},
      create: { name: 'Expiry Test Dept' },
    });
    const faculty = await prisma.faculty.upsert({
      where: { email: 'expiry.test@university.edu' },
      update: { name: 'Dr. Expiry Test', departmentId: dept.id },
      create: { name: 'Dr. Expiry Test', email: 'expiry.test@university.edu', departmentId: dept.id },
    });
    const sponsor = await prisma.sponsor.upsert({
      where: { name_sponsorType: { name: 'Expiry Test Sponsor', sponsorType: 'FEDERAL' } },
      update: {},
      create: { name: 'Expiry Test Sponsor', sponsorType: 'FEDERAL' },
    });

    const awarded = new Date(Date.now() - 180 * 86_400_000);
    const submitted = new Date(Date.now() - 270 * 86_400_000);

    let expSeq = 0;
    const upsertGrant = (title: string, data: object) => {
      const grantNumber = `EXP-TEST-${String(++expSeq).padStart(2, '0')}`;
      return prisma.grant.upsert({
        where: { grantNumber },
        update: data,
        create: { grantNumber, title, sponsorId: sponsor.id, piId: faculty.id, departmentId: dept.id, ...data },
      });
    };

    // Grant expiring in 15 days — should land in bucket 0-30
    await upsertGrant('Grant Expiring In 15 Days', {
      amount: 500000, status: 'AWARDED', submittedAt: submitted, awardedAt: awarded, endAt: daysFromNow(15),
    });

    // Grant expiring in 45 days — should land in bucket 31-60
    await upsertGrant('Grant Expiring In 45 Days', {
      amount: 750000, status: 'AWARDED', submittedAt: submitted, awardedAt: awarded, endAt: daysFromNow(45),
    });

    // AWARDED but no endAt — should be excluded
    await upsertGrant('Grant With No End Date', {
      amount: 300000, status: 'AWARDED', submittedAt: submitted, awardedAt: awarded, endAt: null,
    });

    // DECLINED with endAt in 10 days — should be excluded (not AWARDED)
    await upsertGrant('Declined Grant With End Date', {
      amount: 200000, status: 'DECLINED', submittedAt: submitted, endAt: daysFromNow(10),
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it('returns 401 without auth', async () => {
    await request(app).get('/api/grants/expiring').expect(401);
  });

  it('returns 200 with correct structure', async () => {
    const res = await request(app)
      .get('/api/grants/expiring')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('buckets');
    expect(res.body).toHaveProperty('totalCount');
    expect(res.body).toHaveProperty('totalAmount');
    expect(Array.isArray(res.body.buckets)).toBe(true);
    expect(res.body.buckets).toHaveLength(3);
  });

  it('bucket labels are 0-30, 31-60, 61-90', async () => {
    const res = await request(app)
      .get('/api/grants/expiring')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.buckets[0].label).toBe('0-30');
    expect(res.body.buckets[1].label).toBe('31-60');
    expect(res.body.buckets[2].label).toBe('61-90');
  });

  it('places 15-day grant in bucket 0-30', async () => {
    const res = await request(app)
      .get('/api/grants/expiring')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const bucket030 = res.body.buckets[0];
    const grant15d = bucket030.grants.find((g: { title: string }) => g.title === 'Grant Expiring In 15 Days');
    expect(grant15d).toBeDefined();
    expect(grant15d.daysUntilExpiry).toBeGreaterThanOrEqual(14);
    expect(grant15d.daysUntilExpiry).toBeLessThanOrEqual(16);
  });

  it('places 45-day grant in bucket 31-60', async () => {
    const res = await request(app)
      .get('/api/grants/expiring')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const bucket3160 = res.body.buckets[1];
    const grant45d = bucket3160.grants.find((g: { title: string }) => g.title === 'Grant Expiring In 45 Days');
    expect(grant45d).toBeDefined();
  });

  it('excludes grants with null endAt and non-AWARDED status', async () => {
    const res = await request(app)
      .get('/api/grants/expiring')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.totalCount).toBeGreaterThanOrEqual(2);
    const allTitles = res.body.buckets.flatMap((b: { grants: { title: string }[] }) => b.grants.map((g: { title: string }) => g.title));
    expect(allTitles).not.toContain('Grant With No End Date');
    expect(allTitles).not.toContain('Declined Grant With End Date');
  });

  it('totalAmount matches sum of bucket amounts', async () => {
    const res = await request(app)
      .get('/api/grants/expiring')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const bucketSum = res.body.buckets.reduce((s: number, b: { totalAmount: number }) => s + b.totalAmount, 0);
    expect(res.body.totalAmount).toBe(bucketSum);
    expect(res.body.totalAmount).toBeGreaterThanOrEqual(1250000); // at minimum our test grants
  });
});
