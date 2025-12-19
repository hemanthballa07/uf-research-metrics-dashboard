import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { getTestPrismaClient, setupTestDatabase, cleanupTestDatabase } from '../setup.js';

const prisma = getTestPrismaClient();
const app = createApp();

describe('POST /api/ingest/grants', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it('should reject malformed CSV rows with clear error messages', async () => {
    // CSV with multiple validation errors:
    // Row 2: Invalid email
    // Row 3: Invalid status
    // Row 4: Negative amount
    // Row 5: Missing required field
    const malformedCSV = `title,sponsor_name,sponsor_type,pi_name,pi_email,department_name,amount,status,submitted_at,awarded_at
Valid Grant,NSF,federal,Dr. Jane Smith,jane.smith@university.edu,Engineering,500000,awarded,2024-01-15,2024-03-15
Invalid Email Grant,NSF,federal,Dr. John Doe,invalid-email,Engineering,300000,submitted,2024-02-01,
Invalid Status Grant,NIH,federal,Dr. Bob Lee,bob.lee@university.edu,Medicine,200000,invalid_status,2024-03-01,
Negative Amount Grant,Gates Foundation,foundation,Dr. Alice Kim,alice.kim@university.edu,Biology,-1000,awarded,2024-04-01,2024-05-01
Missing Field Grant,State Research Council,state,Dr. Charlie Brown,charlie.brown@university.edu,,400000,submitted,2024-05-01,`;

    const response = await request(app)
      .post('/api/ingest/grants')
      .set('Content-Type', 'text/plain')
      .send(malformedCSV)
      .expect(200);

    // Should have processed 5 rows total
    expect(response.body.totalRows).toBe(5);

    // Should have inserted 1 valid row
    expect(response.body.inserted).toBe(1);

    // Should have 4 errors (rows 2, 3, 4, 5)
    expect(response.body.errors).toHaveLength(4);

    // Verify error messages are clear and specific
    const errors = response.body.errors;
    
    // Row 2: Invalid email
    const emailError = errors.find((e: { row: number }) => e.row === 2);
    expect(emailError).toBeDefined();
    expect(emailError.error).toContain('pi_email');
    expect(emailError.error.toLowerCase()).toMatch(/invalid|email|format/);

    // Row 3: Invalid status
    const statusError = errors.find((e: { row: number }) => e.row === 3);
    expect(statusError).toBeDefined();
    expect(statusError.error).toContain('status');

    // Row 4: Negative amount
    const amountError = errors.find((e: { row: number }) => e.row === 4);
    expect(amountError).toBeDefined();
    expect(amountError.error).toContain('amount');

    // Row 5: Missing department_name
    const missingFieldError = errors.find((e: { row: number }) => e.row === 5);
    expect(missingFieldError).toBeDefined();
    expect(missingFieldError.error).toContain('department_name');

    // Verify valid row was inserted
    const grant = await prisma.grant.findFirst({
      where: { title: 'Valid Grant' },
    });
    expect(grant).toBeDefined();
    expect(grant?.status).toBe('awarded');
  });

  it('should process valid CSV rows successfully', async () => {
    const validCSV = `title,sponsor_name,sponsor_type,pi_name,pi_email,department_name,amount,status,submitted_at,awarded_at
Test Grant 1,NSF,federal,Dr. Test One,test1@university.edu,Engineering,100000,awarded,2024-01-01,2024-02-01
Test Grant 2,NIH,federal,Dr. Test Two,test2@university.edu,Medicine,200000,submitted,2024-03-01,`;

    const response = await request(app)
      .post('/api/ingest/grants')
      .set('Content-Type', 'text/plain')
      .send(validCSV)
      .expect(200);

    expect(response.body.totalRows).toBe(2);
    expect(response.body.inserted).toBe(2);
    expect(response.body.updated).toBe(0);
    expect(response.body.errors).toHaveLength(0);
  });
});

