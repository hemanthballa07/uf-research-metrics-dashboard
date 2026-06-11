import { Readable } from 'node:stream';
import { parse as csvParse, CsvError } from 'csv-parse';
import {
  csvGrantRowSchema,
  DatabaseError,
  ValidationError,
} from '@uf-research-metrics-platform/shared';
import {
  upsertBatch,
  BATCH_SIZE,
  type IngestionReport,
  type GrantUpsertRow,
} from '@uf-research-metrics-platform/db';
import type { z } from 'zod';

export type { IngestionReport };

type ValidatedRow = z.infer<typeof csvGrantRowSchema>;

export interface ParsedCsv {
  batches: GrantUpsertRow[][];
  totalRows: number;
  errors: Array<{ row: number; error: string; data?: Record<string, unknown> }>;
}

/**
 * Stream + validate a CSV into fixed-size batches of validated rows, WITHOUT
 * touching the database. Used by the async ingest producer (which then publishes
 * each batch to Kafka). Validation is per-row; invalid rows are collected as
 * errors and excluded from the batches.
 */
export async function parseCsvToBatches(
  stream: Readable,
  batchSize: number = BATCH_SIZE,
): Promise<ParsedCsv> {
  const batches: GrantUpsertRow[][] = [];
  const errors: ParsedCsv['errors'] = [];
  let totalRows = 0;
  let rowNumber = 0;
  let current: GrantUpsertRow[] = [];

  const parser = stream.pipe(
    csvParse({ columns: true, skip_empty_lines: true, trim: true, bom: true, relax_quotes: true }),
  );

  try {
    for await (const record of parser as AsyncIterable<Record<string, string>>) {
      rowNumber++;
      totalRows++;
      const mapped = {
        ...record,
        grant_number: record.grant_number || undefined,
        status: typeof record.status === 'string' ? record.status.toUpperCase() : record.status,
        sponsor_type:
          typeof record.sponsor_type === 'string'
            ? record.sponsor_type.toUpperCase()
            : record.sponsor_type,
        submitted_at: record.submitted_at || undefined,
        awarded_at: record.awarded_at || undefined,
        end_at: record.end_at || undefined,
      };
      const validation = csvGrantRowSchema.safeParse(mapped);
      if (!validation.success) {
        errors.push({
          row: rowNumber,
          error: validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          data: record,
        });
        continue;
      }
      current.push(validation.data);
      if (current.length >= batchSize) {
        batches.push(current);
        current = [];
      }
    }
    if (current.length > 0) batches.push(current);
  } catch (err) {
    if (err instanceof CsvError) {
      throw new ValidationError(`Malformed CSV: ${err.message}`);
    }
    throw new DatabaseError('Failed to parse CSV', err);
  }

  if (totalRows === 0) {
    throw new ValidationError('CSV file is empty');
  }
  return { batches, totalRows, errors };
}

/**
 * Async generator that parses a CSV stream and yields one validated batch at a
 * time. Memory usage is O(BATCH_SIZE) regardless of file size. Invalid rows are
 * pushed onto the caller-supplied `errors` array and excluded from batches.
 * Throws ValidationError for an empty CSV or malformed CSV structure.
 */
export async function* streamCsvBatches(
  stream: Readable,
  errors: ParsedCsv['errors'],
  batchSize = BATCH_SIZE,
): AsyncGenerator<GrantUpsertRow[]> {
  const parser = stream.pipe(
    csvParse({ columns: true, skip_empty_lines: true, trim: true, bom: true, relax_quotes: true }),
  );
  let current: GrantUpsertRow[] = [];
  let rowNumber = 0;

  try {
    for await (const record of parser as AsyncIterable<Record<string, string>>) {
      rowNumber++;
      const mapped = {
        ...record,
        grant_number: record.grant_number || undefined,
        status: typeof record.status === 'string' ? record.status.toUpperCase() : record.status,
        sponsor_type:
          typeof record.sponsor_type === 'string'
            ? record.sponsor_type.toUpperCase()
            : record.sponsor_type,
        submitted_at: record.submitted_at || undefined,
        awarded_at: record.awarded_at || undefined,
        end_at: record.end_at || undefined,
      };
      const validation = csvGrantRowSchema.safeParse(mapped);
      if (!validation.success) {
        errors.push({
          row: rowNumber,
          error: validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          data: record,
        });
        continue;
      }
      current.push(validation.data);
      if (current.length >= batchSize) {
        yield current;
        current = [];
      }
    }
    if (current.length > 0) yield current;
  } catch (err) {
    if (err instanceof CsvError) {
      throw new ValidationError(`Malformed CSV: ${err.message}`);
    }
    throw new DatabaseError('Failed to parse CSV', err);
  }

  if (rowNumber === 0) {
    throw new ValidationError('CSV file is empty');
  }
}

/**
 * Ingest grant rows from a CSV stream. Consumes `stream` lazily — memory usage
 * is O(BATCH_SIZE) regardless of total file size. The actual upsert (two-phase,
 * idempotent, lock-tuned) lives in `@uf-research-metrics-platform/db` so the
 * ingest-worker can reuse it; this function owns parsing + per-row validation.
 */
export async function ingestGrantsFromStream(stream: Readable): Promise<IngestionReport> {
  const report: IngestionReport = { totalRows: 0, inserted: 0, updated: 0, errors: [] };

  const parser = stream.pipe(
    csvParse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_quotes: true,
    }),
  );

  let buffer: ValidatedRow[] = [];
  let rowNumber = 0; // 1-indexed across data rows; header is consumed by csv-parse and not counted

  try {
    for await (const record of parser as AsyncIterable<Record<string, string>>) {
      rowNumber++;
      report.totalRows++;

      const mapped = {
        ...record,
        grant_number: record.grant_number || undefined,
        status: typeof record.status === 'string' ? record.status.toUpperCase() : record.status,
        sponsor_type:
          typeof record.sponsor_type === 'string'
            ? record.sponsor_type.toUpperCase()
            : record.sponsor_type,
        submitted_at: record.submitted_at || undefined,
        awarded_at: record.awarded_at || undefined,
        end_at: record.end_at || undefined,
      };

      const validation = csvGrantRowSchema.safeParse(mapped);
      if (!validation.success) {
        const message = validation.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        report.errors.push({ row: rowNumber, error: message, data: record });
        continue;
      }

      buffer.push(validation.data);

      if (buffer.length >= BATCH_SIZE) {
        const result = await upsertBatch(buffer);
        report.inserted += result.inserted;
        report.updated += result.updated;
        buffer = [];
      }
    }

    if (buffer.length > 0) {
      const result = await upsertBatch(buffer);
      report.inserted += result.inserted;
      report.updated += result.updated;
    }
  } catch (err) {
    // csv-parse signals malformed input via its own CsvError class (note: it
    // extends Error but does NOT set `name`, so check instanceof — not name).
    if (err instanceof CsvError) {
      throw new ValidationError(`Malformed CSV: ${err.message}`);
    }
    throw new DatabaseError('Failed to ingest grants from stream', err);
  }

  if (report.totalRows === 0) {
    throw new ValidationError('CSV file is empty');
  }

  return report;
}

/**
 * Back-compat shim — buffers the string into a Readable stream and delegates
 * to the streaming implementation. New callers should use `ingestGrantsFromStream`.
 */
export async function ingestGrantsFromCSV(csvText: string): Promise<IngestionReport> {
  const stream = Readable.from([csvText]);
  return ingestGrantsFromStream(stream);
}
