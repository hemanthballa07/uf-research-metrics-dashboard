import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import type { Logger } from 'pino';
import { getExpiringGrants } from '@uf-research-metrics-platform/db';
import { expiryScansTotal, expiryNotificationsTotal } from './metrics.js';

export const EXPIRY_QUEUE = 'expiry-notifications';
const SCHEDULER_ID = 'expiry-scan';
const SCAN_JOB = 'expiry-scan';
const NOTIFY_JOB = 'notify-expiry';

// Daily 07:00 America/New_York (UF is Eastern); tz is pinned so it doesn't
// default to the container's UTC.
const SCAN_CRON = '0 7 * * *';
const SCAN_TZ = 'America/New_York';

interface NotifyExpiryData {
  grantId: number;
  title: string;
  piName: string;
  piEmail: string;
  departmentName: string;
  sponsorName: string;
  amount: number;
  endAt: string | null;
  daysUntilExpiry: number;
  bucket: string;
}

/**
 * Pluggable notification sink. No email infra exists yet, so this is a
 * structured-log stub — swap the body for an email/Slack client when one lands.
 */
async function deliverNotification(data: NotifyExpiryData, log: Logger): Promise<void> {
  log.info(
    {
      event: 'expiry.notification',
      grantId: data.grantId,
      piEmail: data.piEmail,
      daysUntilExpiry: data.daysUntilExpiry,
      bucket: data.bucket,
      amount: data.amount,
    },
    `grant "${data.title}" expires in ${data.daysUntilExpiry} day(s)`,
  );
}

/**
 * Stand up the BullMQ queue + worker for nightly grant-expiry notifications,
 * co-located in the ingest-worker process. One repeatable scan (registered via
 * the idempotent job scheduler, so restarts never stack duplicate schedulers)
 * fans out one notify-expiry job per expiring grant.
 *
 * `connection` MUST be a dedicated ioredis instance with maxRetriesPerRequest:
 * null — BullMQ blocks its connection, so this is not the worker's job-store/cache client.
 */
export async function startExpiryNotifications(
  connection: ConnectionOptions,
  log: Logger,
): Promise<{ queue: Queue; worker: Worker }> {
  const queue = new Queue(EXPIRY_QUEUE, { connection });

  const worker = new Worker(
    EXPIRY_QUEUE,
    async (job: Job) => {
      if (job.name === SCAN_JOB) {
        return runScan(queue, log);
      }
      if (job.name === NOTIFY_JOB) {
        return deliverNotification(job.data as NotifyExpiryData, log);
      }
      log.warn({ jobName: job.name }, 'unknown expiry job, skipping');
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    if (job?.name === NOTIFY_JOB) expiryNotificationsTotal.inc({ result: 'failed' });
    if (job?.name === SCAN_JOB) expiryScansTotal.inc({ result: 'failed' });
    log.error(
      { jobId: job?.id, jobName: job?.name, attemptsMade: job?.attemptsMade, err: err.message },
      'expiry job failed',
    );
  });

  // Idempotent on SCHEDULER_ID: registering it on every startup just refreshes
  // the schedule rather than creating duplicates.
  await queue.upsertJobScheduler(
    SCHEDULER_ID,
    { pattern: SCAN_CRON, tz: SCAN_TZ },
    { name: SCAN_JOB, opts: { removeOnComplete: true, removeOnFail: 100 } },
  );

  log.info(`expiry-notifications scheduler registered (cron "${SCAN_CRON}" ${SCAN_TZ})`);
  return { queue, worker };
}

/** Scan for expiring grants and enqueue one notification job per grant. */
async function runScan(queue: Queue, log: Logger): Promise<void> {
  const { buckets, totalCount } = await getExpiringGrants();
  let enqueued = 0;

  for (const bucket of buckets) {
    for (const g of bucket.grants) {
      const data: NotifyExpiryData = {
        grantId: g.id,
        title: g.title,
        piName: g.pi?.name ?? 'unknown',
        piEmail: g.pi?.email ?? 'unknown',
        departmentName: g.department?.name ?? 'unknown',
        sponsorName: g.sponsor?.name ?? 'unknown',
        amount: g.amount,
        endAt: g.endAt ? new Date(g.endAt).toISOString() : null,
        daysUntilExpiry: g.daysUntilExpiry,
        bucket: bucket.label,
      };
      // BullMQ custom job IDs cannot contain ':', so use '-' and the endAt epoch.
      const endAtMs = g.endAt ? new Date(g.endAt).getTime() : 'na';
      await queue.add(NOTIFY_JOB, data, {
        // De-dup a given grant within one scan run; a re-scan the next night
        // re-notifies (the days-until-expiry will have changed).
        jobId: `notify-${g.id}-${endAtMs}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 100,
      });
      enqueued++;
      expiryNotificationsTotal.inc({ result: 'enqueued' });
    }
  }

  expiryScansTotal.inc({ result: 'ok' });
  log.info({ totalCount, enqueued }, 'expiry scan complete');
}
