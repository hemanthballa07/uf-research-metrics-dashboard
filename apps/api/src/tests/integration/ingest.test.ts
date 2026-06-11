import { Readable } from 'node:stream';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { parseCsvToBatches } from '../../services/ingestService.js';
import { setupTestDatabase, cleanupTestDatabase, getViewerToken } from '../setup.js';

const app = createApp();

// CSV parsing + validation is unit-tested directly (no Kafka). The full async
// round-trip (produce → worker consume → job complete) is verified by the live
// e2e script with Redpanda running.
describe('parseCsvToBatches', () => {
  it('separates valid rows into batches and collects per-row validation errors', async () => {
    const csv = `title,sponsor_name,sponsor_type,pi_name,pi_email,department_name,amount,status,submitted_at,awarded_at
Valid Grant,NSF,FEDERAL,Dr. Jane Smith,jane.smith@university.edu,Engineering,500000,AWARDED,2024-01-15,2024-03-15
Invalid Email Grant,NSF,FEDERAL,Dr. John Doe,invalid-email,Engineering,300000,SUBMITTED,2024-02-01,
Invalid Status Grant,NIH,FEDERAL,Dr. Bob Lee,bob.lee@university.edu,Medicine,200000,invalid_status,2024-03-01,
Negative Amount Grant,Gates Foundation,FOUNDATION,Dr. Alice Kim,alice.kim@university.edu,Biology,-1000,AWARDED,2024-04-01,2024-05-01
Missing Field Grant,State Research Council,STATE,Dr. Charlie Brown,charlie.brown@university.edu,,400000,SUBMITTED,2024-05-01,`;

    const { batches, totalRows, errors } = await parseCsvToBatches(Readable.from([csv]));

    expect(totalRows).toBe(5);
    expect(batches.flat()).toHaveLength(1); // only the valid row
    expect(errors).toHaveLength(4);
    expect(errors.find((e) => e.row === 2)?.error).toContain('pi_email');
    expect(errors.find((e) => e.row === 3)?.error).toContain('status');
    expect(errors.find((e) => e.row === 4)?.error).toContain('amount');
    expect(errors.find((e) => e.row === 5)?.error).toContain('department_name');
  });

  it('rejects a structurally malformed CSV', async () => {
    const bad =
      'title,sponsor_name,sponsor_type,pi_name,pi_email,department_name,amount,status,submitted_at,awarded_at,end_at\n' +
      'too,few,columns';
    await expect(parseCsvToBatches(Readable.from([bad]))).rejects.toThrow(/Malformed CSV/i);
  });

  it('rejects an empty CSV', async () => {
    await expect(parseCsvToBatches(Readable.from(['']))).rejects.toThrow(/empty/i);
  });
});

describe('POST /api/ingest/grants — authorization', () => {
  let viewerToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    viewerToken = await getViewerToken();
  });
  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it('returns 403 for a VIEWER (rejected at middleware before any produce)', async () => {
    const csv = `title,sponsor_name,sponsor_type,pi_name,pi_email,department_name,amount,status,submitted_at,awarded_at
Viewer Grant,NSF,FEDERAL,Dr. Viewer,viewer@university.edu,Engineering,100000,AWARDED,2024-01-01,2024-02-01`;
    const res = await request(app)
      .post('/api/ingest/grants')
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('Content-Type', 'text/plain')
      .send(csv)
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
