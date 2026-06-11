import { Readable } from 'node:stream';
import { prisma } from '@uf-research-metrics-platform/db';
import { parseCsvToBatches } from './ingestService.js';
import type { GrantUpsertRow } from '@uf-research-metrics-platform/db';

export interface ReconciliationSummary {
  totalRows: number;
  parseErrors: number;
  matched: number;
  new: number;
  discrepant: number;
  dataQualityViolations: number;
}

export interface ParseError {
  row: number;
  error: string;
}

export interface DataQualityViolation {
  row: number;
  grantNumber?: string;
  title: string;
  piEmail: string;
  violations: string[];
}

export interface Discrepancy {
  grantNumber?: string;
  title: string;
  piEmail: string;
  field: string;
  csvValue: string | number | null;
  dbValue: string | number | null;
}

export interface NewRow {
  grantNumber?: string;
  title: string;
  piEmail: string;
  department: string;
  amount: number;
  status: string;
}

export interface ReconciliationReport {
  summary: ReconciliationSummary;
  parseErrors: ParseError[];
  dataQualityViolations: DataQualityViolation[];
  discrepancies: Discrepancy[];
  new: NewRow[];
}

interface DbGrantRow {
  id: number;
  grantNumber: string | null;
  title: string;
  amount: number;
  status: string;
  submittedAt: Date | null;
  awardedAt: Date | null;
  endAt: Date | null;
  piEmail: string;
  departmentName: string;
  sponsorName: string;
  sponsorType: string;
}

/** Data-quality rules applied to each validated CSV row before DB lookup. */
function checkDataQuality(row: GrantUpsertRow, rowNumber: number): DataQualityViolation | null {
  const violations: string[] = [];

  if (row.submitted_at && row.awarded_at && row.awarded_at < row.submitted_at) {
    violations.push('awarded_at is before submitted_at');
  }
  if (row.awarded_at && row.end_at && row.end_at < row.awarded_at) {
    violations.push('end_at is before awarded_at');
  }
  if (row.status === 'AWARDED' && row.amount === 0) {
    violations.push('AWARDED grant has amount = 0');
  }
  if (row.status === 'AWARDED' && !row.awarded_at) {
    violations.push('AWARDED grant is missing awarded_at');
  }

  if (violations.length === 0) return null;
  return { row: rowNumber, grantNumber: row.grant_number, title: row.title, piEmail: row.pi_email, violations };
}

/** Compare a validated CSV row against its DB counterpart; return any field discrepancies. */
function findDiscrepancies(row: GrantUpsertRow, db: DbGrantRow): Discrepancy[] {
  const result: Discrepancy[] = [];
  const base = { grantNumber: row.grant_number, title: row.title, piEmail: row.pi_email };

  if (Math.abs(row.amount - db.amount) > 0.01) {
    result.push({ ...base, field: 'amount', csvValue: row.amount, dbValue: db.amount });
  }
  if (row.status !== db.status) {
    result.push({ ...base, field: 'status', csvValue: row.status, dbValue: db.status });
  }
  if (row.pi_email !== db.piEmail) {
    result.push({ ...base, field: 'pi_email', csvValue: row.pi_email, dbValue: db.piEmail });
  }
  if (row.department_name !== db.departmentName) {
    result.push({ ...base, field: 'department_name', csvValue: row.department_name, dbValue: db.departmentName });
  }
  if (row.sponsor_name !== db.sponsorName) {
    result.push({ ...base, field: 'sponsor_name', csvValue: row.sponsor_name, dbValue: db.sponsorName });
  }

  return result;
}

/**
 * Parse a CSV without writing to the DB. Compares each row against the current
 * DB state (by grantNumber, or by (title, pi_email) for legacy rows) and
 * returns a structured exception report the analyst reviews before committing
 * the upload. ADMIN-only — does not change any data.
 */
export async function reconcileFromStream(stream: Readable): Promise<ReconciliationReport> {
  const { batches, errors: rawParseErrors } = await parseCsvToBatches(stream);

  const parseErrors: ParseError[] = rawParseErrors.map((e) => ({ row: e.row, error: e.error }));
  const allRows: Array<{ row: GrantUpsertRow; rowNumber: number }> = [];

  // Row numbers for valid rows start after any parse-errored rows. Since
  // parseCsvToBatches assigns per-row numbers 1..N including errored rows, the
  // first valid-row number is determined by the parse-error set.
  const errorRowNumbers = new Set(rawParseErrors.map((e) => e.row));
  let rowCounter = 0;
  for (const batch of batches) {
    for (const row of batch) {
      rowCounter++;
      // Skip row numbers already used by parse errors.
      while (errorRowNumbers.has(rowCounter)) rowCounter++;
      allRows.push({ row, rowNumber: rowCounter });
    }
  }

  // ── Data-quality checks ────────────────────────────────────────────────────
  const dataQualityViolations: DataQualityViolation[] = [];
  for (const { row, rowNumber: rn } of allRows) {
    const violation = checkDataQuality(row, rn);
    if (violation) dataQualityViolations.push(violation);
  }

  // ── Bulk DB lookups ────────────────────────────────────────────────────────
  const numberedRows = allRows.filter((r) => r.row.grant_number);
  const legacyRows = allRows.filter((r) => !r.row.grant_number);

  const grantNumbers = numberedRows.map((r) => r.row.grant_number as string);
  const legacyTitles = legacyRows.map((r) => r.row.title);
  const legacyEmails = legacyRows.map((r) => r.row.pi_email);

  const [dbByNumber, dbByTitleEmail] = await Promise.all([
    grantNumbers.length > 0
      ? prisma.$queryRawUnsafe<DbGrantRow[]>(
          `SELECT g.id, g."grantNumber", g.title, g.amount::float AS amount,
                  g.status::text AS status,
                  g."submittedAt", g."awardedAt", g."endAt",
                  f.email AS "piEmail", d.name AS "departmentName",
                  s.name AS "sponsorName", s."sponsorType"::text AS "sponsorType"
           FROM grants g
           JOIN faculty f ON f.id = g."piId"
           JOIN departments d ON d.id = g."departmentId"
           JOIN sponsors s ON s.id = g."sponsorId"
           WHERE g."grantNumber" = ANY($1::text[])`,
          grantNumbers,
        )
      : Promise.resolve([]),
    legacyRows.length > 0
      ? prisma.$queryRawUnsafe<DbGrantRow[]>(
          `SELECT g.id, g."grantNumber", g.title, g.amount::float AS amount,
                  g.status::text AS status,
                  g."submittedAt", g."awardedAt", g."endAt",
                  f.email AS "piEmail", d.name AS "departmentName",
                  s.name AS "sponsorName", s."sponsorType"::text AS "sponsorType"
           FROM grants g
           JOIN faculty f ON f.id = g."piId"
           JOIN departments d ON d.id = g."departmentId"
           JOIN sponsors s ON s.id = g."sponsorId"
           WHERE g."grantNumber" IS NULL
             AND g.title = ANY($1::text[])
             AND f.email = ANY($2::text[])`,
          legacyTitles,
          legacyEmails,
        )
      : Promise.resolve([]),
  ]);

  const byNumber = new Map<string, DbGrantRow>(
    dbByNumber.map((g) => [g.grantNumber as string, g]),
  );
  // For legacy rows the natural key is (title, piEmail).
  const byTitleEmail = new Map<string, DbGrantRow>(
    dbByTitleEmail.map((g) => [`${g.title}::${g.piEmail}`, g]),
  );

  // ── Classify each CSV row ──────────────────────────────────────────────────
  const discrepancies: Discrepancy[] = [];
  const newRows: NewRow[] = [];
  let matched = 0;

  for (const { row } of allRows) {
    const db = row.grant_number
      ? byNumber.get(row.grant_number)
      : byTitleEmail.get(`${row.title}::${row.pi_email}`);

    if (!db) {
      newRows.push({
        grantNumber: row.grant_number,
        title: row.title,
        piEmail: row.pi_email,
        department: row.department_name,
        amount: row.amount,
        status: row.status,
      });
      continue;
    }

    const diffs = findDiscrepancies(row, db);
    if (diffs.length === 0) {
      matched++;
    } else {
      discrepancies.push(...diffs);
    }
  }

  // Count distinct discrepant grants (one grant can have multiple differing fields).
  const discrepantGrantKeys = new Set(
    discrepancies.map((d) => d.grantNumber ?? `${d.title}::${d.piEmail}`),
  );

  return {
    summary: {
      totalRows: allRows.length + parseErrors.length,
      parseErrors: parseErrors.length,
      matched,
      new: newRows.length,
      discrepant: discrepantGrantKeys.size,
      dataQualityViolations: dataQualityViolations.length,
    },
    parseErrors,
    dataQualityViolations,
    discrepancies,
    new: newRows,
  };
}
