import { describe, it, expect } from 'vitest';
import { csvGrantRowSchema } from '@uf-research-metrics-platform/shared';

describe('CSV Grant Row Validation', () => {
  it('should validate a valid CSV grant row', () => {
    const validRow = {
      title: 'Test Grant',
      sponsor_name: 'National Science Foundation',
      sponsor_type: 'FEDERAL',
      pi_name: 'Dr. Jane Smith',
      pi_email: 'jane.smith@university.edu',
      department_name: 'Engineering',
      amount: '500000',
      status: 'AWARDED',
      submitted_at: '2024-01-15',
      awarded_at: '2024-03-15',
    };

    const result = csvGrantRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Test Grant');
      expect(result.data.amount).toBe(500000);
      expect(result.data.status).toBe('AWARDED');
    }
  });

  it('should reject invalid email', () => {
    const invalidRow = {
      title: 'Test Grant',
      sponsor_name: 'National Science Foundation',
      sponsor_type: 'FEDERAL',
      pi_name: 'Dr. Jane Smith',
      pi_email: 'invalid-email',
      department_name: 'Engineering',
      amount: '500000',
      status: 'AWARDED',
    };

    const result = csvGrantRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });

  it('should reject invalid status', () => {
    const invalidRow = {
      title: 'Test Grant',
      sponsor_name: 'National Science Foundation',
      sponsor_type: 'FEDERAL',
      pi_name: 'Dr. Jane Smith',
      pi_email: 'jane.smith@university.edu',
      department_name: 'Engineering',
      amount: '500000',
      status: 'invalid_status',
    };

    const result = csvGrantRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });

  it('should reject negative amount', () => {
    const invalidRow = {
      title: 'Test Grant',
      sponsor_name: 'National Science Foundation',
      sponsor_type: 'FEDERAL',
      pi_name: 'Dr. Jane Smith',
      pi_email: 'jane.smith@university.edu',
      department_name: 'Engineering',
      amount: '-1000',
      status: 'AWARDED',
    };

    const result = csvGrantRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });

  it('should coerce string amounts to numbers', () => {
    const row = {
      title: 'Test Grant',
      sponsor_name: 'National Science Foundation',
      sponsor_type: 'FEDERAL',
      pi_name: 'Dr. Jane Smith',
      pi_email: 'jane.smith@university.edu',
      department_name: 'Engineering',
      amount: '750000.50',
      status: 'AWARDED',
    };

    const result = csvGrantRowSchema.safeParse(row);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.amount).toBe('number');
      expect(result.data.amount).toBe(750000.5);
    }
  });

  it('should handle nullable dates', () => {
    const row = {
      title: 'Test Grant',
      sponsor_name: 'National Science Foundation',
      sponsor_type: 'FEDERAL',
      pi_name: 'Dr. Jane Smith',
      pi_email: 'jane.smith@university.edu',
      department_name: 'Engineering',
      amount: '500000',
      status: 'SUBMITTED',
      submitted_at: null,
      awarded_at: null,
    };

    const result = csvGrantRowSchema.safeParse(row);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.submitted_at).toBeNull();
      expect(result.data.awarded_at).toBeNull();
    }
  });

  it('accepts an optional grant_number and exposes it on the parsed row', () => {
    const base = {
      title: 'Stable Key Grant',
      sponsor_name: 'NIH',
      sponsor_type: 'FEDERAL',
      pi_name: 'Dr. Ada Lovelace',
      pi_email: 'ada@ufl.edu',
      department_name: 'Medicine',
      amount: '50000',
      status: 'AWARDED',
      grant_number: 'AWD-2026-00123',
    };
    const parsed = csvGrantRowSchema.parse(base);
    expect(parsed.grant_number).toBe('AWD-2026-00123');
  });

  it('still parses a row with no grant_number (legacy export)', () => {
    const parsed = csvGrantRowSchema.parse({
      title: 'Legacy Grant',
      sponsor_name: 'NIH',
      sponsor_type: 'FEDERAL',
      pi_name: 'Dr. Ada Lovelace',
      pi_email: 'ada@ufl.edu',
      department_name: 'Medicine',
      amount: '50000',
      status: 'AWARDED',
    });
    expect(parsed.grant_number).toBeUndefined();
  });
});

