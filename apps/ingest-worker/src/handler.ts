import type Redis from 'ioredis';
import type { Logger } from 'pino';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import {
  upsertBatch,
  getGrantsByIds,
  upsertEmbedding,
  embedTextFor,
} from '@uf-research-metrics-platform/db';
import { embed, embeddingsEnabled, EMBEDDING_MODEL } from '@uf-research-metrics-platform/embeddings';
import {
  getProducer,
  recordBatchResult,
  TOPICS,
  type GrantBatchReceived,
  type GrantIngested,
  type GrantFailed,
  type GrantBatchDlq,
} from '@uf-research-metrics-platform/events';
import { ingestRowsTotal, batchesProcessedTotal, embeddingsTotal } from './metrics.js';

const tracer = trace.getTracer('uf-ingest-worker');

export interface HandlerDeps {
  redis: Redis;
  log: Logger;
  maxAttempts: number;
}

/** Best-effort invalidation of the API's analytics caches after new data lands. */
async function bustReadCaches(redis: Redis): Promise<void> {
  try {
    for (const pattern of ['api:/metrics/*', 'api:/insights:*']) {
      let cursor = '0';
      const keysToDelete: string[] = [];
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        keysToDelete.push(...keys);
      } while (cursor !== '0');
      if (keysToDelete.length > 0) await redis.del(...keysToDelete);
    }
  } catch {
    /* cache is best-effort */
  }
}

/**
 * Best-effort: embed the just-upserted grants into pgvector. Never throws — an
 * embedding-provider outage must not fail ingestion. Disable for bulk loads with
 * EMBED_ON_INGEST=false (use the reindex/embed script instead).
 */
async function embedIngestedGrants(grantIds: number[], log: Logger): Promise<void> {
  if (process.env.EMBED_ON_INGEST === 'false' || !embeddingsEnabled() || grantIds.length === 0) {
    return;
  }
  try {
    const grants = await getGrantsByIds(grantIds);
    const vectors = await embed(grants.map(embedTextFor));
    for (let i = 0; i < grants.length; i++) {
      await upsertEmbedding(grants[i].id, vectors[i], EMBEDDING_MODEL);
    }
    embeddingsTotal.inc({ result: 'ok' }, grants.length);
  } catch (e) {
    embeddingsTotal.inc({ result: 'error' }, grantIds.length);
    log.warn({ err: (e as Error).message }, 'embed-on-ingest failed (best-effort)');
  }
}

/**
 * Process one batch with bounded retries + exponential backoff. On success, emit
 * grant.ingested and advance the job. After maxAttempts failures, route the batch
 * to the dead-letter topic + grant.failed, and still advance the job (the failure
 * is visible via the DLQ / grant.failed, so the polling client never hangs).
 * At-least-once delivery is safe because upsertBatch is idempotent.
 */
export async function handleBatch(
  env: GrantBatchReceived,
  { redis, log, maxAttempts }: HandlerDeps,
): Promise<void> {
  // Each batch becomes a parent span; the kafkajs consume span (auto-instrumented)
  // is its parent, so the full trace runs API → kafka.produce → kafka.consume →
  // handleBatch → (Postgres + embed-on-ingest + DLQ-on-failure) in one Jaeger view.
  return tracer.startActiveSpan(
    'handleBatch',
    {
      attributes: {
        'uf.jobId': env.jobId,
        'uf.batchIndex': env.batchIndex,
        'uf.rows': env.rows.length,
      },
    },
    async (span) => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const { inserted, updated, grantIds } = await upsertBatch(env.rows);
          ingestRowsTotal.inc({ result: 'inserted' }, inserted);
          ingestRowsTotal.inc({ result: 'updated' }, updated);
          batchesProcessedTotal.inc({ result: 'ok' });
          await recordBatchResult(redis, env.jobId, { inserted, updated });
          await bustReadCaches(redis);
          await embedIngestedGrants(grantIds, log);
          const producer = await getProducer();
          const ev: GrantIngested = {
            jobId: env.jobId,
            batchIndex: env.batchIndex,
            inserted,
            updated,
          };
          await producer.send({
            topic: TOPICS.GRANT_INGESTED,
            messages: [{ key: env.jobId, value: JSON.stringify(ev) }],
          });
          span.setAttributes({ 'uf.inserted': inserted, 'uf.updated': updated, 'uf.attempts': attempt });
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          return;
        } catch (e) {
          lastError = e;
          log.warn(
            { jobId: env.jobId, batchIndex: env.batchIndex, attempt, err: (e as Error).message },
            'batch upsert failed',
          );
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1))); // 250ms, 500ms, …
          }
        }
      }

      // Retries exhausted → dead-letter the batch and advance the job.
      const errMsg = (lastError as Error)?.message ?? 'unknown error';
      log.error(
        { jobId: env.jobId, batchIndex: env.batchIndex, attempts: maxAttempts, err: errMsg },
        'batch failed after retries, routing to DLQ',
      );
      batchesProcessedTotal.inc({ result: 'dlq' });
      ingestRowsTotal.inc({ result: 'error' }, env.rows.length);
      const producer = await getProducer();
      const dlq: GrantBatchDlq = { ...env, error: errMsg, attempts: maxAttempts };
      await producer.send({
        topic: TOPICS.GRANT_BATCH_DLQ,
        messages: [{ key: env.jobId, value: JSON.stringify(dlq) }],
      });
      const failed: GrantFailed = {
        jobId: env.jobId,
        batchIndex: env.batchIndex,
        error: errMsg,
        attempts: maxAttempts,
      };
      await producer.send({
        topic: TOPICS.GRANT_FAILED,
        messages: [{ key: env.jobId, value: JSON.stringify(failed) }],
      });
      await recordBatchResult(redis, env.jobId, { inserted: 0, updated: 0 });
      span.setAttributes({ 'uf.dlq': true, 'uf.attempts': maxAttempts });
      span.setStatus({ code: SpanStatusCode.ERROR, message: errMsg });
      span.end();
    },
  );
}
