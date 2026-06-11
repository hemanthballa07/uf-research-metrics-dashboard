import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { streamCsvBatches, type ParsedCsv } from '../services/ingestService.js';
import { getRedisClient } from '../lib/cache.js';
import {
  getProducer,
  createJob,
  initJob,
  finalizeJob,
  getJob,
  TOPICS,
} from '@uf-research-metrics-platform/events';
import { NotFoundError } from '@uf-research-metrics-platform/shared';

/**
 * Async ingest: stream the CSV one batch at a time, producing each to Kafka
 * immediately and discarding it — peak RSS is O(BATCH_SIZE) regardless of file
 * size. The job slot is reserved in Redis before the first produce (initJob),
 * then the real counts are written after all batches are produced (finalizeJob).
 * The ingest-worker performs the actual upserts; the client polls
 * GET /api/ingest/jobs/:id.
 */
export async function ingestGrantsHandler(req: Request, res: Response): Promise<void> {
  const jobId = randomUUID();
  const redis = getRedisClient();
  const producer = await getProducer();
  const allErrors: ParsedCsv['errors'] = [];
  let batchIndex = 0;
  let validRows = 0;
  let jobInitialized = false;

  for await (const rows of streamCsvBatches(req, allErrors)) {
    if (!jobInitialized) {
      // Reserve the slot before the first Kafka produce so recordBatchResult
      // always finds the job even if the worker is very fast.
      await initJob(redis, jobId);
      jobInitialized = true;
    }
    validRows += rows.length;
    await producer.send({
      topic: TOPICS.GRANT_BATCH_RECEIVED,
      messages: [{ key: jobId, value: JSON.stringify({ jobId, batchIndex, rows }) }],
    });
    batchIndex++;
  }

  const totalRows = validRows + allErrors.length;
  const errorPayload = allErrors.map((e) => ({ row: e.row, error: e.error }));

  if (!jobInitialized) {
    // All rows were invalid; no Kafka messages sent — create a completed job.
    await createJob(redis, { jobId, totalRows, totalBatches: 0, errors: errorPayload });
  } else {
    await finalizeJob(redis, jobId, { totalBatches: batchIndex, totalRows, errors: errorPayload });
  }

  res.status(202).json({
    jobId,
    status: batchIndex === 0 ? 'completed' : 'queued',
    totalRows,
    batches: batchIndex,
    errors: allErrors,
  });
}

/** Poll target for the async ingest: returns the job record from Redis. */
export async function getIngestJobHandler(req: Request, res: Response): Promise<void> {
  const job = await getJob(getRedisClient(), req.params.id);
  if (!job) {
    throw new NotFoundError(`Ingest job ${req.params.id} not found`);
  }
  res.status(200).json(job);
}
