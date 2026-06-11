import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { getTestPrismaClient, setupTestDatabase, cleanupTestDatabase, getAuthToken, getViewerToken } from '../setup.js';

const prisma = getTestPrismaClient();
const app = createApp();

const CSV_HEADERS =
  'title,grant_number,sponsor_name,sponsor_type,pi_name,pi_email,department_name,amount,status,submitted_at,awarded_at,end_at';

function csvRow(overrides: Record<string, string | number> = {}): string {
  const defaults: Record<string, string | number> = {
    title: 'R01 Neuroscience Study',
    grant_number: 'UF-AWD-RECON-001',
    sponsor_name: 'NIH',
    sponsor_type: 'FEDERAL',
    pi_name: 'Dr. Recon PI',
    pi_email: 'recon.pi@ufl.edu',
    department_name: 'Neuroscience',
    amount: 250000,
    status: 'AWARDED',
    submitted_at: '2024-01-10',
    awarded_at: '2024-03-01',
    end_at: '2026-03-01',
  };
  const merged = { ...defaults, ...overrides };
  return Object.values(merged).join(',');
}

describe('POST /api/reconcile', () => {
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    adminToken = await getAuthToken();
    viewerToken = await getViewerToken();
  });

  afterAll(async () => {
    await prisma.grant.deleteMany({});
    await prisma.faculty.deleteMany({});
    await prisma.sponsor.deleteMany({});
    await prisma.department.deleteMany({});
    await cleanupTestDatabase();
  });

  it('returns 401 without authentication', async () => {
    const csv = `${CSV_HEADERS}\n${csvRow()}`;
    await request(app)
      .post('/api/reconcile')
      .set('Content-Type', 'text/plain')
      .send(csv)
      .expect(401);
  });

  it('returns 403 for a VIEWER', async () => {
    const csv = `${CSV_HEADERS}\n${csvRow()}`;
    await request(app)
      .post('/api/reconcile')
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('Content-Type', 'text/plain')
      .send(csv)
      .expect(403);
  });

  it('classifies rows not in DB as "new" and returns correct shape', async () => {
    const rows = [
      csvRow({ grant_number: 'UF-AWD-SHAPE-001', title: 'Shape Test 1', amount: 100000 }),
      csvRow({ grant_number: 'UF-AWD-SHAPE-002', title: 'Shape Test 2', amount: 200000 }),
    ];
    const csv = `${CSV_HEADERS}\n${rows.join('\n')}`;
    const res = await request(app)
      .post('/api/reconcile')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'text/plain')
      .send(csv)
      .expect(200);

    const { summary, parseErrors, dataQualityViolations, discrepancies } = res.body;
    expect(typeof summary.totalRows).toBe('number');
    expect(typeof summary.matched).toBe('number');
    expect(typeof summary.new).toBe('number');
    expect(typeof summary.discrepant).toBe('number');
    expect(typeof summary.dataQualityViolations).toBe('number');
    expect(Array.isArray(parseErrors)).toBe(true);
    expect(Array.isArray(dataQualityViolations)).toBe(true);
    expect(Array.isArray(discrepancies)).toBe(true);
    expect(Array.isArray(res.body.new)).toBe(true);

    expect(summary.totalRows).toBe(2);
    expect(summary.new).toBe(2);
    expect(summary.matched).toBe(0);
    expect(summary.parseErrors).toBe(0);
    expect(res.body.new[0]).toHaveProperty('grantNumber');
    expect(res.body.new[0]).toHaveProperty('title');
    expect(res.body.new[0]).toHaveProperty('piEmail');
  });

  it('flags data-quality violations for AWARDED grants with amount = 0', async () => {
    const csv = `${CSV_HEADERS}\n${csvRow({ amount: 0 })}`;
    const res = await request(app)
      .post('/api/reconcile')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'text/plain')
      .send(csv)
      .expect(200);

    expect(res.body.summary.dataQualityViolations).toBe(1);
    const violation = res.body.dataQualityViolations[0];
    expect(violation.violations).toContain('AWARDED grant has amount = 0');
  });

  it('flags data-quality violation when awarded_at is before submitted_at', async () => {
    const csv = `${CSV_HEADERS}\n${csvRow({
      submitted_at: '2024-06-01',
      awarded_at: '2024-01-01',
    })}`;
    const res = await request(app)
      .post('/api/reconcile')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'text/plain')
      .send(csv)
      .expect(200);

    expect(res.body.summary.dataQualityViolations).toBe(1);
    expect(res.body.dataQualityViolations[0].violations).toContain(
      'awarded_at is before submitted_at',
    );
  });

  it('counts parse errors in summary without failing the whole request', async () => {
    // A row with an invalid email will fail schema validation.
    const badRow = csvRow({ pi_email: 'not-an-email' });
    const goodRow = csvRow({ grant_number: 'UF-AWD-RECON-PARSE-001', pi_email: 'valid@ufl.edu' });
    const csv = `${CSV_HEADERS}\n${badRow}\n${goodRow}`;
    const res = await request(app)
      .post('/api/reconcile')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'text/plain')
      .send(csv)
      .expect(200);

    expect(res.body.summary.totalRows).toBe(2);
    expect(res.body.summary.parseErrors).toBe(1);
    // The valid row should still be classified.
    expect(res.body.summary.new + res.body.summary.matched).toBe(1);
    expect(res.body.parseErrors).toHaveLength(1);
    expect(res.body.parseErrors[0].error).toMatch(/pi_email/i);
  });
});
