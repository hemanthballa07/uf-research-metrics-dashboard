import 'dotenv/config';
import { describe, it, expect, afterAll } from 'vitest';
import pino from 'pino';
import { prisma } from '@uf-research-metrics-platform/db';
import { runPrune } from '../src/auditLogRetention.js';

// Postgres-only (no broker). audit_logs.actorId has no FK, so a synthetic actor is fine.
const log = pino({ level: 'silent' });
const ACTOR = 990000 + (Date.now() % 1000);

async function makeAudit(targetId: string, ageDays: number): Promise<number> {
  const row = await prisma.auditLog.create({
    data: { action: 'TEST_PRUNE', targetType: 'Test', targetId, actorId: ACTOR },
  });
  await prisma.$executeRawUnsafe(
    `UPDATE audit_logs SET "createdAt" = now() - make_interval(days => $1::int) WHERE id = $2`,
    ageDays,
    row.id,
  );
  return row.id;
}

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { actorId: ACTOR } });
  await prisma.$disconnect();
});

describe('audit-log retention prune', () => {
  it('deletes rows older than the retention window, keeps recent ones', async () => {
    delete process.env.AUDIT_LOG_RETENTION_DAYS; // default 365
    const oldId = await makeAudit('old', 400);
    const recentId = await makeAudit('recent', 1);

    const deleted = await runPrune(log);

    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(await prisma.auditLog.findUnique({ where: { id: oldId } })).toBeNull();
    expect(await prisma.auditLog.findUnique({ where: { id: recentId } })).not.toBeNull();
  });

  it('clamps a sub-floor retention so the DAU 24h window survives', async () => {
    const dayOldId = await makeAudit('floor', 1);
    process.env.AUDIT_LOG_RETENTION_DAYS = '0'; // clamped to >= 2 days in code
    await runPrune(log);
    delete process.env.AUDIT_LOG_RETENTION_DAYS;
    expect(await prisma.auditLog.findUnique({ where: { id: dayOldId } })).not.toBeNull();
  });
});
