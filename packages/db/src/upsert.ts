import { prisma } from './client.js';
import { csvGrantRowSchema, type SponsorType } from '@uf-research-metrics-platform/shared';
import type { z } from 'zod';
import type { Prisma } from '@prisma/client';

/** The interactive-transaction client passed to upsertBatch's callback. */
type TxClient = Prisma.TransactionClient;

/** Shape consumed by the grant-upsert helpers (FKs already resolved). */
interface PreparedGrantInput {
  title: string;
  grantNumber: string | null;
  sponsorId: number;
  piId: number;
  departmentId: number;
  amount: string;
  status: string;
  submittedAt: Date | null;
  awardedAt: Date | null;
  endAt: Date | null;
}

/** A validated grant row, ready to upsert. Same shape the CSV/Kafka path produces. */
export type GrantUpsertRow = z.infer<typeof csvGrantRowSchema>;

export interface IngestionReport {
  totalRows: number;
  inserted: number;
  updated: number;
  errors: Array<{
    row: number;
    error: string;
    data?: Record<string, unknown>;
  }>;
}

// Larger batches than a per-row implementation: each batch does one statement
// per dim table + one for grants, so 500 rows ≈ 5 round-trips instead of 2000.
export const BATCH_SIZE = 500;

/**
 * Format a JS Date | null array as a Postgres array literal string.
 * Avoids the node-pg type-inference failure that surfaces as
 *   `cannot cast type integer[] to timestamp without time zone[]`
 * when every element is null and the driver cannot pick a typed OID.
 * Bind the result as text in the query and apply `::timestamp[]` in SQL.
 */
function pgTimestampArrayLiteral(values: (Date | null)[]): string {
  const parts = values.map((d) => (d == null ? 'NULL' : `"${d.toISOString()}"`));
  return `{${parts.join(',')}}`;
}

/**
 * Idempotent two-phase upsert of one batch of validated grant rows.
 * Phase 1 bulk-upserts the dimension tables (departments, faculty, sponsors) once
 * per batch; phase 2 is dual-path — grants carrying a stable grantNumber upsert via ON CONFLICT ("grantNumber") (title is mutable), and legacy rows without one fall back to ON CONFLICT (title, "piId") WHERE "grantNumber" IS NULL. Wrapped in
 * a transaction with SET LOCAL lock_timeout/statement_timeout to fail fast under
 * contention. inserted/updated derived from `(xmax = 0)`.
 *
 * Shared by the API (CSV stream) and the ingest-worker (Kafka consumer).
 */
export async function upsertBatch(
  rows: GrantUpsertRow[],
): Promise<{ inserted: number; updated: number; grantIds: number[] }> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '2s'`);
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '30s'`);

    // ----- Phase 1a: departments ----------------------------------------
    const deptNames = Array.from(new Set(rows.map((r) => r.department_name)));
    await tx.$executeRawUnsafe(
      `INSERT INTO departments (name, "createdAt", "updatedAt")
       SELECT n, NOW(), NOW() FROM unnest($1::text[]) AS t(n)
       ON CONFLICT (name) DO NOTHING`,
      deptNames,
    );
    const deptRows = await tx.$queryRawUnsafe<{ id: number; name: string }[]>(
      `SELECT id, name FROM departments WHERE name = ANY($1::text[])`,
      deptNames,
    );
    const deptIdByName = new Map<string, number>(deptRows.map((d) => [d.name, d.id]));

    // ----- Phase 1b: faculty --------------------------------------------
    // Deduplicate by email — later row wins.
    const facByEmail = new Map<string, { name: string; deptId: number }>();
    for (const r of rows) {
      const deptId = deptIdByName.get(r.department_name);
      if (deptId == null) continue;
      facByEmail.set(r.pi_email, { name: r.pi_name, deptId });
    }
    const facNames: string[] = [];
    const facEmails: string[] = [];
    const facDeptIds: number[] = [];
    for (const [email, info] of facByEmail) {
      facNames.push(info.name);
      facEmails.push(email);
      facDeptIds.push(info.deptId);
    }
    if (facEmails.length > 0) {
      await tx.$executeRawUnsafe(
        `INSERT INTO faculty (name, email, "departmentId", "createdAt", "updatedAt")
         SELECT n, e, d, NOW(), NOW()
         FROM unnest($1::text[], $2::text[], $3::int[]) AS t(n, e, d)
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           "departmentId" = EXCLUDED."departmentId",
           "updatedAt" = NOW()`,
        facNames,
        facEmails,
        facDeptIds,
      );
    }
    const facRows = await tx.$queryRawUnsafe<{ id: number; email: string }[]>(
      `SELECT id, email FROM faculty WHERE email = ANY($1::text[])`,
      facEmails,
    );
    const facIdByEmail = new Map<string, number>(facRows.map((f) => [f.email, f.id]));

    // ----- Phase 1c: sponsors (composite unique key) --------------------
    const sponsorByKey = new Map<string, { name: string; type: SponsorType }>();
    for (const r of rows) {
      const key = `${r.sponsor_name}::${r.sponsor_type}`;
      sponsorByKey.set(key, { name: r.sponsor_name, type: r.sponsor_type });
    }
    const sNames: string[] = [];
    const sTypes: string[] = [];
    for (const v of sponsorByKey.values()) {
      sNames.push(v.name);
      sTypes.push(v.type);
    }
    if (sNames.length > 0) {
      await tx.$executeRawUnsafe(
        `INSERT INTO sponsors (name, "sponsorType", "createdAt", "updatedAt")
         SELECT n, t::"SponsorType", NOW(), NOW()
         FROM unnest($1::text[], $2::text[]) AS s(n, t)
         ON CONFLICT (name, "sponsorType") DO NOTHING`,
        sNames,
        sTypes,
      );
    }
    const sponsorRows = await tx.$queryRawUnsafe<
      { id: number; name: string; sponsorType: string }[]
    >(
      `SELECT id, name, "sponsorType"::text AS "sponsorType"
       FROM sponsors
       WHERE (name, "sponsorType") IN (
         SELECT n, t::"SponsorType" FROM unnest($1::text[], $2::text[]) AS s(n, t)
       )`,
      sNames,
      sTypes,
    );
    const sponsorIdByKey = new Map<string, number>(
      sponsorRows.map((s) => [`${s.name}::${s.sponsorType}`, s.id]),
    );

    // ----- Phase 2: grants (dual-path dedup) ----------------------------
    // Resolve FKs and partition by whether the row carries a stable grantNumber.
    const prepared: PreparedGrantInput[] = [];
    for (const r of rows) {
      const sId = sponsorIdByKey.get(`${r.sponsor_name}::${r.sponsor_type}`);
      const pId = facIdByEmail.get(r.pi_email);
      const dId = deptIdByName.get(r.department_name);
      if (sId == null || pId == null || dId == null) continue;
      prepared.push({
        title: r.title,
        grantNumber: r.grant_number ?? null,
        sponsorId: sId,
        piId: pId,
        departmentId: dId,
        amount: String(r.amount),
        status: r.status,
        submittedAt: r.submitted_at ?? null,
        awardedAt: r.awarded_at ?? null,
        endAt: r.end_at ?? null,
      });
    }

    // Within-batch dedup (last-wins), mirroring the dim-table dedup above:
    // ON CONFLICT DO UPDATE cannot affect the same target row twice in one
    // statement, so a batch that repeats a grantNumber (or a title+piId) must be
    // collapsed first.
    const byNumber = new Map<string, PreparedGrantInput>();
    const byTitlePi = new Map<string, PreparedGrantInput>();
    for (const g of prepared) {
      if (g.grantNumber !== null) byNumber.set(g.grantNumber, g);
      else byTitlePi.set(`${g.title}::${g.piId}`, g);
    }
    const withNumber = Array.from(byNumber.values());
    const legacy = Array.from(byTitlePi.values());

    let inserted = 0;
    let updated = 0;
    const grantIds: number[] = [];

    function tally(res: { id: number; inserted: boolean }[]): void {
      for (const r of res) {
        if (r.inserted) inserted++;
        else updated++;
        grantIds.push(r.id);
      }
    }

    if (withNumber.length > 0) tally(await upsertGrantsByNumber(tx, withNumber));
    if (legacy.length > 0) tally(await upsertGrantsByTitlePi(tx, legacy));

    return { inserted, updated, grantIds };
  });
}

/** Column arrays shared by both upsert paths. */
function toGrantArrays(rows: PreparedGrantInput[]): {
  titles: string[];
  sponsorIds: number[];
  piIds: number[];
  deptIds: number[];
  amounts: string[];
  statuses: string[];
  submittedAts: (Date | null)[];
  awardedAts: (Date | null)[];
  endAts: (Date | null)[];
} {
  return {
    titles: rows.map((g) => g.title),
    sponsorIds: rows.map((g) => g.sponsorId),
    piIds: rows.map((g) => g.piId),
    deptIds: rows.map((g) => g.departmentId),
    amounts: rows.map((g) => g.amount),
    statuses: rows.map((g) => g.status),
    submittedAts: rows.map((g) => g.submittedAt),
    awardedAts: rows.map((g) => g.awardedAt),
    endAts: rows.map((g) => g.endAt),
  };
}

/** Upsert grants that carry a stable grantNumber; title IS updated on conflict. */
async function upsertGrantsByNumber(
  tx: TxClient,
  rows: PreparedGrantInput[],
): Promise<{ id: number; inserted: boolean }[]> {
  const a = toGrantArrays(rows);
  const grantNumbers = rows.map((g) => g.grantNumber as string);

  // Legacy adoption: a numbered row whose (title, piId) matches an existing
  // grantNumber-less row claims that row's grantNumber in place, so the upsert
  // below UPDATEs it instead of INSERTing a duplicate. Without this, the first
  // numbered ingest duplicates the entire pre-existing portfolio. The NOT EXISTS
  // guard skips adoption when that number is already assigned elsewhere (avoids a
  // grants_grantNumber_key violation; the by-number upsert then updates the
  // existing holder). Idempotent — once adopted the row is no longer NULL, and in
  // steady state this matches nothing and is cheap via the partial index.
  await tx.$executeRawUnsafe(
    `UPDATE grants AS g SET "grantNumber" = m.gn, "updatedAt" = NOW()
     FROM unnest($1::text[], $2::int[], $3::text[]) AS m(title, pi_id, gn)
     WHERE g.title = m.title AND g."piId" = m.pi_id AND g."grantNumber" IS NULL
       AND NOT EXISTS (SELECT 1 FROM grants x WHERE x."grantNumber" = m.gn)`,
    a.titles,
    a.piIds,
    grantNumbers,
  );

  return tx.$queryRawUnsafe<{ id: number; inserted: boolean }[]>(
    `INSERT INTO grants (
       title, "grantNumber", "sponsorId", "piId", "departmentId",
       amount, status, "submittedAt", "awardedAt", "endAt",
       "createdAt", "updatedAt"
     )
     SELECT t, gn, s, p, d, a::numeric, st::"GrantStatus", sb, aw, en, NOW(), NOW()
     FROM unnest(
       $1::text[], $2::text[], $3::int[], $4::int[], $5::int[],
       $6::text[], $7::text[], $8::timestamp[], $9::timestamp[], $10::timestamp[]
     ) AS g(t, gn, s, p, d, a, st, sb, aw, en)
     ON CONFLICT ("grantNumber") DO UPDATE SET
       title = EXCLUDED.title,
       "sponsorId" = EXCLUDED."sponsorId",
       "piId" = EXCLUDED."piId",
       "departmentId" = EXCLUDED."departmentId",
       amount = EXCLUDED.amount,
       status = EXCLUDED.status,
       "submittedAt" = EXCLUDED."submittedAt",
       "awardedAt" = EXCLUDED."awardedAt",
       "endAt" = EXCLUDED."endAt",
       "updatedAt" = NOW()
     RETURNING id, (xmax = 0) AS inserted`,
    a.titles,
    grantNumbers,
    a.sponsorIds,
    a.piIds,
    a.deptIds,
    a.amounts,
    a.statuses,
    pgTimestampArrayLiteral(a.submittedAts),
    pgTimestampArrayLiteral(a.awardedAts),
    pgTimestampArrayLiteral(a.endAts),
  );
}

/** Legacy path for rows without a grantNumber; dedups on (title, piId). */
async function upsertGrantsByTitlePi(
  tx: TxClient,
  rows: PreparedGrantInput[],
): Promise<{ id: number; inserted: boolean }[]> {
  const a = toGrantArrays(rows);
  return tx.$queryRawUnsafe<{ id: number; inserted: boolean }[]>(
    `INSERT INTO grants (
       title, "sponsorId", "piId", "departmentId",
       amount, status, "submittedAt", "awardedAt", "endAt",
       "createdAt", "updatedAt"
     )
     SELECT t, s, p, d, a::numeric, st::"GrantStatus", sb, aw, en, NOW(), NOW()
     FROM unnest(
       $1::text[], $2::int[], $3::int[], $4::int[],
       $5::text[], $6::text[], $7::timestamp[], $8::timestamp[], $9::timestamp[]
     ) AS g(t, s, p, d, a, st, sb, aw, en)
     ON CONFLICT (title, "piId") WHERE "grantNumber" IS NULL DO UPDATE SET
       "sponsorId" = EXCLUDED."sponsorId",
       "departmentId" = EXCLUDED."departmentId",
       amount = EXCLUDED.amount,
       status = EXCLUDED.status,
       "submittedAt" = EXCLUDED."submittedAt",
       "awardedAt" = EXCLUDED."awardedAt",
       "endAt" = EXCLUDED."endAt",
       "updatedAt" = NOW()
     RETURNING id, (xmax = 0) AS inserted`,
    a.titles,
    a.sponsorIds,
    a.piIds,
    a.deptIds,
    a.amounts,
    a.statuses,
    pgTimestampArrayLiteral(a.submittedAts),
    pgTimestampArrayLiteral(a.awardedAts),
    pgTimestampArrayLiteral(a.endAts),
  );
}
