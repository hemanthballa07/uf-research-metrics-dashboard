import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { upsertBatch, type GrantUpsertRow } from '@uf-research-metrics-platform/db';
import { getTestPrismaClient, setupTestDatabase, cleanupTestDatabase } from '../setup.js';

const prisma = getTestPrismaClient();
const tag = `up${Date.now()}`;

function buildRows(n: number): GrantUpsertRow[] {
  const sponsors: Array<[string, GrantUpsertRow['sponsor_type']]> = [
    ['NIH', 'FEDERAL'],
    ['Pfizer Inc.', 'INDUSTRY'],
  ];
  return Array.from({ length: n }, (_, i) => {
    const [sponsor_name, sponsor_type] = sponsors[i % sponsors.length];
    const awarded = i % 2 === 0;
    return {
      title: `${tag} Grant ${String(i).padStart(5, '0')}`,
      grant_number: `${tag}-AWD-${String(i).padStart(5, '0')}`,
      sponsor_name,
      sponsor_type,
      pi_name: `Dr. ${tag} ${i % 50}`,
      pi_email: `${tag}.${i % 50}@ufl.edu`,
      department_name: 'Medicine',
      amount: (i + 1) * 1000,
      status: awarded ? 'AWARDED' : 'SUBMITTED',
      submitted_at: new Date('2026-01-15'),
      awarded_at: awarded ? new Date('2026-04-01') : null,
      end_at: awarded ? new Date('2029-04-01') : null,
    } satisfies GrantUpsertRow;
  });
}

describe('upsertBatch — idempotent two-phase upsert', () => {
  const ROWS = 1500; // exercises a large single transaction across the dim + grant phases

  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await prisma.grant.deleteMany({ where: { title: { startsWith: `${tag} ` } } });
    await prisma.faculty.deleteMany({ where: { email: { startsWith: `${tag}.` } } });
    await cleanupTestDatabase();
  });

  it('inserts all rows on first upsert', async () => {
    const res = await upsertBatch(buildRows(ROWS));
    expect(res.inserted).toBe(ROWS);
    expect(res.updated).toBe(0);
    const count = await prisma.grant.count({ where: { title: { startsWith: `${tag} ` } } });
    expect(count).toBe(ROWS);
  });

  it('is idempotent: re-upserting the same rows updates, never duplicates', async () => {
    const res = await upsertBatch(buildRows(ROWS));
    expect(res.inserted).toBe(0);
    expect(res.updated).toBe(ROWS);
    const count = await prisma.grant.count({ where: { title: { startsWith: `${tag} ` } } });
    expect(count).toBe(ROWS); // no duplicates
  });

  it('overwrites mutable fields on conflict (status + amount)', async () => {
    const [first] = buildRows(1);
    const res = await upsertBatch([{ ...first, status: 'DECLINED', amount: 999999 }]);
    expect(res.updated).toBe(1);
    expect(res.inserted).toBe(0);
    const grant = await prisma.grant.findFirst({ where: { title: first.title } });
    expect(grant?.status).toBe('DECLINED');
    expect(Number(grant?.amount)).toBe(999999);
  });

  it('updates (never duplicates) when the title changes but grantNumber is stable', async () => {
    // Dedicated identity so this row is NOT one of the bulk-inserted rows above.
    const row = { ...buildRows(1)[0], grant_number: `${tag}-RENAME`, title: `${tag} rename original` };
    const first = await upsertBatch([row]);
    expect(first.inserted).toBe(1);

    // Upstream corrects the title; the award number is unchanged.
    const renamed = { ...row, title: `${tag} rename corrected` };
    const second = await upsertBatch([renamed]);

    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(1);

    const count = await prisma.grant.count({ where: { grantNumber: row.grant_number } });
    expect(count).toBe(1); // the fix: a title change no longer creates a duplicate

    const grant = await prisma.grant.findFirst({ where: { grantNumber: row.grant_number } });
    expect(grant?.title).toBe(renamed.title); // and the new title is persisted
  });

  it('collapses duplicate grant_numbers within one batch (last-wins, no error)', async () => {
    // A messy export can repeat an award in one batch; ON CONFLICT cannot touch a
    // row twice in one statement, so the upsert must dedup the batch first.
    const base = { ...buildRows(1)[0], grant_number: `${tag}-DUP`, title: `${tag} dup a` };
    const dupe = { ...base, title: `${tag} dup b`, amount: 777 };
    const res = await upsertBatch([base, dupe]);
    expect(res.inserted).toBe(1); // one row, not an error
    const grant = await prisma.grant.findFirst({ where: { grantNumber: base.grant_number } });
    expect(grant?.title).toBe(dupe.title); // last-wins
  });

  it('adopts an existing legacy row when a grant_number later arrives (no duplicate)', async () => {
    const ident = { gn: `${tag}-ADOPT`, title: `${tag} adopt me` };
    // First seen with no number (legacy path) ...
    const legacyFirst = { ...buildRows(1)[0], grant_number: undefined, title: ident.title };
    const r1 = await upsertBatch([legacyFirst]);
    expect(r1.inserted).toBe(1);
    // ... then the export starts carrying the Award ID for the same (title, piId).
    const numbered = { ...buildRows(1)[0], grant_number: ident.gn, title: ident.title };
    const r2 = await upsertBatch([numbered]);
    expect(r2.inserted).toBe(0); // adopted, not inserted
    const count = await prisma.grant.count({ where: { title: ident.title } });
    expect(count).toBe(1); // the legacy row was adopted, not duplicated
    const grant = await prisma.grant.findFirst({ where: { title: ident.title } });
    expect(grant?.grantNumber).toBe(ident.gn);
  });

  it('legacy rows without grantNumber still dedup via (title, piId)', async () => {
    const [base] = buildRows(1);
    const legacy = { ...base, grant_number: undefined, title: `${tag} legacy ${base.title}` };
    const r1 = await upsertBatch([legacy]);
    expect(r1.inserted).toBe(1);
    const r2 = await upsertBatch([legacy]);
    expect(r2.updated).toBe(1);
    const count = await prisma.grant.count({ where: { title: legacy.title } });
    expect(count).toBe(1);
  });

  it('two grants sharing title+PI but different grantNumbers both insert (renewal)', async () => {
    const [a] = buildRows(1);
    const sharedTitle = `${tag} renewal ${a.title}`;
    const y1 = { ...a, grant_number: `${a.grant_number}-Y1`, title: sharedTitle };
    const y2 = { ...a, grant_number: `${a.grant_number}-Y2`, title: sharedTitle };

    const r1 = await upsertBatch([y1]);
    expect(r1.inserted).toBe(1);

    const r2 = await upsertBatch([y2]); // same title+PI, different award number
    expect(r2.inserted).toBe(1);

    const count = await prisma.grant.count({ where: { title: sharedTitle } });
    expect(count).toBe(2);
  });

  it('within one batch, a legacy row and a numbered row sharing title+PI collapse into one grant', async () => {
    // Same underlying grant described twice in one CSV export: one line hasn't
    // picked up the Award ID yet, the other already has it. Both are brand new
    // to the DB in this call, so the legacy-adoption UPDATE (which only fires
    // cross-batch, after the legacy row already exists) can't save us here —
    // the within-batch partition must not let these race into two rows.
    const [a] = buildRows(1);
    const sharedTitle = `${tag} crosspath ${a.title}`;
    const legacyRow = { ...a, grant_number: undefined, title: sharedTitle };
    const numberedRow = { ...a, grant_number: `${a.grant_number}-XPATH`, title: sharedTitle };

    const res = await upsertBatch([legacyRow, numberedRow]);

    const count = await prisma.grant.count({ where: { title: sharedTitle } });
    expect(count).toBe(1); // one grant, not a numbered + a duplicate legacy row
    expect(res.inserted).toBe(1);

    const grant = await prisma.grant.findFirst({ where: { title: sharedTitle } });
    expect(grant?.grantNumber).toBe(numberedRow.grant_number);
  });

  it('updates piId when the same grantNumber re-ingests with a different PI', async () => {
    const base = buildRows(1)[0];
    const gn = `${tag}-PICHANGE`;
    const first = {
      ...base,
      grant_number: gn,
      title: `${tag} pi-change`,
      pi_name: `Dr. ${tag} A`,
      pi_email: `${tag}.pi-a@ufl.edu`,
    };
    await upsertBatch([first]);
    const g1 = await prisma.grant.findFirst({ where: { grantNumber: gn }, include: { pi: true } });
    expect(g1?.pi.email).toBe(`${tag}.pi-a@ufl.edu`);

    // Same Award ID, new PI (a PI transfer upstream).
    const second = { ...first, pi_name: `Dr. ${tag} B`, pi_email: `${tag}.pi-b@ufl.edu` };
    const res = await upsertBatch([second]);
    expect(res.updated).toBe(1);

    const g2 = await prisma.grant.findFirst({ where: { grantNumber: gn }, include: { pi: true } });
    expect(g2?.pi.email).toBe(`${tag}.pi-b@ufl.edu`); // before the fix: still pi-a (piId not updated)
  });
});
