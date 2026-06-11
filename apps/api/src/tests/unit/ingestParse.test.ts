import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { parseCsvToBatches } from '../../services/ingestService.js';

describe('parseCsvToBatches — grant_number handling (Kafka producer path)', () => {
  const header =
    'title,grant_number,sponsor_name,sponsor_type,pi_name,pi_email,department_name,amount,status';

  it('carries a populated grant_number into the parsed batch', async () => {
    const csv = `${header}\nStable Grant,AWD-2026-00777,NIH,FEDERAL,Dr. Ada,ada@ufl.edu,Medicine,50000,AWARDED\n`;
    const { batches, errors } = await parseCsvToBatches(Readable.from([csv]));
    expect(errors).toHaveLength(0);
    expect(batches[0][0].grant_number).toBe('AWD-2026-00777');
  });

  it('routes an empty grant_number cell to the legacy path instead of rejecting the row', async () => {
    const csv = `${header}\nLegacy Grant,,NIH,FEDERAL,Dr. Ada,ada@ufl.edu,Medicine,50000,AWARDED\n`;
    const { batches, errors } = await parseCsvToBatches(Readable.from([csv]));
    expect(errors).toHaveLength(0); // before the fix the "" grant_number fails .min(1) and the row is rejected
    expect(batches[0][0].grant_number).toBeUndefined();
  });
});
