import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import type { Logger } from 'pino';
import { prisma } from '@uf-research-metrics-platform/db';
import { auditLogPruneTotal } from './metrics.js';

export const AUDIT_RETENTION_QUEUE = 'audit-retention';
const SCHEDULER_ID = 'audit-log-prune';
const PRUNE_JOB = 'audit-log-prune';

// Daily 02:00 America/New_York (offset from the 07:00 expiry scan); tz pinned so
// it doesn't default to the container's UTC.
const PRUNE_CRON = process.env.AUDIT_LOG_PRUNE_CRON ?? '0 2 * * *';
const PRUNE_TZ = process.env.AUDIT_LOG_PRUNE_TZ ?? 'America/New_York';

// Floor the retention so a mis-set small/zero value can never delete rows inside
// the DAU collector's 24h window (apps/api/src/middleware/prometheusMetrics.ts
// queries audit_logs for the last day; deleting those breaks uf_daily_active_users).
const RETENTION_FLOOR_DAYS = 2;
const DELETE_BATCH = 10_000;

function retentionDays(log: Logger): number {
  const raw = Number(process.env.AUDIT_LOG_RETENTION_DAYS ?? 365);
  const days = Number.isFinite(raw) ? raw : 365;
  if (days < RETENTION_FLOOR_DAYS) {
    log.warn(
      { requested: process.env.AUDIT_LOG_RETENTION_DAYS, floorDays: RETENTION_FLOOR_DAYS },
      'AUDIT_LOG_RETENTION_DAYS below floor; clamping to protect the DAU 24h window',
    );
  }
  return Math.max(RETENTION_FLOOR_DAYS, days);
}

/**
 * Stand up the BullMQ queue + worker for audit-log retention pruning, co-located
 * in the ingest-worker process (mirrors startExpiryNotifications). One repeatable
 * job — registered via the idempotent job scheduler, so restarts never stack
 * duplicate schedulers — hard-deletes audit_logs older than the retention window.
 *
 * `connection` MUST be the dedicated maxRetriesPerRequest:null ioredis instance
 * (BullMQ blocks its connection — not the worker's job-store/cache client).
 */
export async function startAuditLogRetention(
  connection: ConnectionOptions,
  log: Logger,
): Promise<{ queue: Queue; worker: Worker }> {
  const queue = new Queue(AUDIT_RETENTION_QUEUE, { connection });

  const worker = new Worker(
    AUDIT_RETENTION_QUEUE,
    async (job: Job) => {
      if (job.name === PRUNE_JOB) {
        return runPrune(log);
      }
      log.warn({ jobName: job.name }, 'unknown audit-retention job, skipping');
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    auditLogPruneTotal.inc({ result: 'error' });
    log.error(
      { jobId: job?.id, jobName: job?.name, attemptsMade: job?.attemptsMade, err: err.message },
      'audit-retention job failed',
    );
  });

  await queue.upsertJobScheduler(
    SCHEDULER_ID,
    { pattern: PRUNE_CRON, tz: PRUNE_TZ },
    { name: PRUNE_JOB, opts: { removeOnComplete: true, removeOnFail: 100 } },
  );

  log.info(`audit-log-retention scheduler registered (cron "${PRUNE_CRON}" ${PRUNE_TZ})`);
  return { queue, worker };
}

/**
 * Hard-delete audit_logs older than the retention window, in batches so the first
 * prune of a long-unpruned table doesn't take one giant lock/transaction.
 * Exported for the integration test. Returns the number of rows deleted.
 */
export async function runPrune(log: Logger): Promise<number> {
  const days = retentionDays(log);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let deleted = 0;

  for (;;) {
    const stale = await prisma.auditLog.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: DELETE_BATCH,
    });
    if (stale.length === 0) break;
    const res = await prisma.auditLog.deleteMany({
      where: { id: { in: stale.map((r) => r.id) } },
    });
    deleted += res.count;
    if (stale.length < DELETE_BATCH) break;
  }

  auditLogPruneTotal.inc({ result: 'ok' });
  log.info({ deleted, cutoff: cutoff.toISOString(), retentionDays: days }, 'audit-log prune complete');
  return deleted;
}
