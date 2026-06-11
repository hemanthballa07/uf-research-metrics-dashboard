import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@uf-research-metrics-platform/db';
import { createUser, deleteUser } from '../../services/userService.js';

// audit_logs.actorId has no FK; a synthetic actor avoids depending on seed data and
// can't collide with the freshly-created (small) user id, so deleteUser won't self-delete.
const ACTOR = 999999;

async function waitForAudit(action: string, targetId: string, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const row = await prisma.auditLog.findFirst({ where: { action, targetId }, orderBy: { id: 'desc' } });
    if (row) return row;
    if (Date.now() > deadline) throw new Error(`audit ${action}/${targetId} not written within ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe('audit-log PII minimization', () => {
  const email = `pii-min-${Date.now()}@university.edu`;
  let userId = 0;

  afterAll(async () => {
    if (userId) await prisma.auditLog.deleteMany({ where: { targetType: 'User', targetId: String(userId) } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('USER_CREATED metadata records role but never the email', async () => {
    const user = await createUser({ email, name: 'PII Min', password: 'password123', role: 'VIEWER' }, ACTOR);
    userId = user.id;
    const row = await waitForAudit('USER_CREATED', String(user.id));
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    expect(meta.role).toBe('VIEWER');
    expect(meta.email).toBeUndefined();
    expect(JSON.stringify(meta)).not.toContain('@');
  });

  it('USER_DELETED metadata contains no email', async () => {
    await deleteUser(userId, ACTOR);
    const row = await waitForAudit('USER_DELETED', String(userId));
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    expect(meta.email).toBeUndefined();
    expect(JSON.stringify(meta)).not.toContain('@');
  });
});
