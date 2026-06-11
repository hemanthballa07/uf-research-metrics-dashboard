import type Redis from 'ioredis';

/**
 * Ingest job lifecycle, stored in Redis. The API creates a job when it produces
 * a CSV's batches; the worker updates progress as it consumes each batch; the API
 * status endpoint reads it for the frontend to poll.
 *
 * Concurrency: batch messages are keyed by jobId, so all batches of one job land
 * on a single partition → one consumer processes them sequentially. That makes the
 * GET-modify-SET update in `recordBatchResult` safe without a lock.
 */
export interface IngestJob {
  jobId: string;
  status: 'queued' | 'processing' | 'completed';
  totalRows: number;
  totalBatches: number;
  batchesDone: number;
  inserted: number;
  updated: number;
  errors: Array<{ row: number; error: string }>;
  createdAt: string;
  updatedAt: string;
}

const JOB_TTL_SECONDS = 24 * 60 * 60;
const key = (jobId: string): string => `ingest:job:${jobId}`;

export async function createJob(
  redis: Redis,
  job: Omit<IngestJob, 'status' | 'batchesDone' | 'inserted' | 'updated' | 'createdAt' | 'updatedAt'>,
): Promise<IngestJob> {
  const now = new Date().toISOString();
  const record: IngestJob = {
    ...job,
    status: job.totalBatches === 0 ? 'completed' : 'queued',
    batchesDone: 0,
    inserted: 0,
    updated: 0,
    createdAt: now,
    updatedAt: now,
  };
  await redis.set(key(job.jobId), JSON.stringify(record), 'EX', JOB_TTL_SECONDS);
  return record;
}

export async function getJob(redis: Redis, jobId: string): Promise<IngestJob | null> {
  const raw = await redis.get(key(jobId));
  return raw ? (JSON.parse(raw) as IngestJob) : null;
}

/**
 * Apply one batch's result: increment counters and mark the job completed when the
 * last batch lands. Safe because a job's batches are processed by a single consumer
 * (jobId partition key). No-op if the job record has expired/missing.
 */
export async function recordBatchResult(
  redis: Redis,
  jobId: string,
  result: { inserted: number; updated: number },
): Promise<IngestJob | null> {
  const job = await getJob(redis, jobId);
  if (!job) return null;
  job.batchesDone += 1;
  job.inserted += result.inserted;
  job.updated += result.updated;
  job.status = job.totalBatches > 0 && job.batchesDone >= job.totalBatches ? 'completed' : 'processing';
  job.updatedAt = new Date().toISOString();
  await redis.set(key(jobId), JSON.stringify(job), 'EX', JOB_TTL_SECONDS);
  return job;
}

/**
 * Reserve a job slot before streaming produce begins. Uses a sentinel
 * totalBatches of -1 so recordBatchResult never marks the job completed
 * until finalizeJob sets the real count.
 */
export async function initJob(redis: Redis, jobId: string): Promise<IngestJob> {
  const now = new Date().toISOString();
  const record: IngestJob = {
    jobId,
    status: 'queued',
    totalRows: 0,
    totalBatches: -1,
    batchesDone: 0,
    inserted: 0,
    updated: 0,
    errors: [],
    createdAt: now,
    updatedAt: now,
  };
  await redis.set(key(jobId), JSON.stringify(record), 'EX', JOB_TTL_SECONDS);
  return record;
}

/**
 * Set the real totalBatches/totalRows/errors once all batches have been
 * produced. Re-evaluates status in case the worker already processed every
 * batch before this call landed.
 */
export async function finalizeJob(
  redis: Redis,
  jobId: string,
  update: { totalBatches: number; totalRows: number; errors: Array<{ row: number; error: string }> },
): Promise<IngestJob | null> {
  const job = await getJob(redis, jobId);
  if (!job) return null;
  job.totalBatches = update.totalBatches;
  job.totalRows = update.totalRows;
  job.errors = update.errors;
  job.status =
    update.totalBatches === 0 || job.batchesDone >= update.totalBatches ? 'completed' : 'queued';
  job.updatedAt = new Date().toISOString();
  await redis.set(key(jobId), JSON.stringify(job), 'EX', JOB_TTL_SECONDS);
  return job;
}
