import 'dotenv/config'; // load apps/ingest-worker/.env locally; no-op in CI/containers
import http from 'node:http';
import Redis from 'ioredis';
import pino from 'pino';
import { trace } from '@opentelemetry/api';
import {
  createConsumer,
  ensureTopic,
  getProducer,
  TOPICS,
  INGEST_WORKER_GROUP,
  grantBatchReceivedSchema,
  type GrantPoisonDlq,
} from '@uf-research-metrics-platform/events';
import { registry, batchesProcessedTotal } from './metrics.js';
import { startExpiryNotifications } from './expiryNotifications.js';
import { startAuditLogRetention } from './auditLogRetention.js';
import { handleBatch } from './handler.js';

const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // Inject traceId/spanId into every log line when OTEL is active, so a single
  // upload's API logs and worker logs share a traceId for cross-service pivot.
  mixin() {
    const ctx = trace.getActiveSpan()?.spanContext();
    return ctx?.traceId ? { traceId: ctx.traceId, spanId: ctx.spanId } : {};
  },
});
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});
// Dedicated connection for BullMQ — it issues blocking commands and would
// monopolise the job-store/cache client above, so it gets its own.
const bullConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const METRICS_PORT = Number(process.env.WORKER_METRICS_PORT ?? 3003);
const MAX_ATTEMPTS = Number(process.env.INGEST_MAX_ATTEMPTS ?? 3);

async function start(): Promise<void> {
  // Ensure the topic exists with enough partitions for the worker HPA's max.
  // Idempotent — kafkajs returns false (not error) when the topic already exists.
  // Setting GRANT_BATCH_PARTITIONS < worker.autoscaling.maxReplicas wastes
  // worker pods (one active consumer per partition per group).
  const partitions = Number(process.env.GRANT_BATCH_PARTITIONS ?? 3);
  try {
    await ensureTopic(TOPICS.GRANT_BATCH_RECEIVED, partitions);
    log.info(`topic ${TOPICS.GRANT_BATCH_RECEIVED} ensured with >= ${partitions} partitions`);
  } catch (e) {
    log.warn(
      { err: (e as Error).message },
      'ensureTopic failed; relying on auto-create — worker may run at reduced parallelism',
    );
  }

  const consumer = createConsumer(INGEST_WORKER_GROUP);
  await consumer.connect();
  // fromBeginning so a fresh consumer group never drops batches produced during
  // its initial join/rebalance — safe because upsertBatch is idempotent
  // (at-least-once delivery + idempotent consumer).
  await consumer.subscribe({ topic: TOPICS.GRANT_BATCH_RECEIVED, fromBeginning: true });
  log.info(`ingest-worker consuming ${TOPICS.GRANT_BATCH_RECEIVED}`);

  await consumer.run({
    eachMessage: async ({ partition, message }) => {
      const raw = message.value?.toString() ?? '';
      let env;
      try {
        env = grantBatchReceivedSchema.parse(JSON.parse(raw));
      } catch (e) {
        const errMsg = (e as Error).message;
        log.error({ err: errMsg }, 'unparseable batch, routing to poison DLQ');
        batchesProcessedTotal.inc({ result: 'error' });
        try {
          const producer = await getProducer();
          const poison: GrantPoisonDlq = {
            raw: raw.slice(0, 4096),
            error: errMsg,
            topic: TOPICS.GRANT_BATCH_RECEIVED,
            partition,
            offset: message.offset,
          };
          await producer.send({
            topic: TOPICS.GRANT_POISON_DLQ,
            messages: [{ value: JSON.stringify(poison) }],
          });
        } catch (dlqErr) {
          log.error({ err: (dlqErr as Error).message }, 'failed to route poison message to DLQ');
        }
        return;
      }

      await handleBatch(env, { redis, log, maxAttempts: MAX_ATTEMPTS });
    },
  });

  const expiry = await startExpiryNotifications(bullConnection, log);
  expiryHandles = expiry;

  const audit = await startAuditLogRetention(bullConnection, log);
  auditHandles = audit;

  http
    .createServer(async (req, res) => {
      if (req.url === '/metrics') {
        res.setHeader('Content-Type', registry.contentType);
        res.end(await registry.metrics());
      } else if (req.url === '/health') {
        res.end('ok');
      } else {
        res.statusCode = 404;
        res.end();
      }
    })
    .listen(METRICS_PORT, () => log.info(`ingest-worker /metrics on :${METRICS_PORT}`));
}

let expiryHandles: Awaited<ReturnType<typeof startExpiryNotifications>> | undefined;
let auditHandles: Awaited<ReturnType<typeof startAuditLogRetention>> | undefined;

start().catch((e) => {
  log.error(e, 'ingest-worker failed to start');
  process.exit(1);
});

const shutdown = async (): Promise<void> => {
  await expiryHandles?.worker.close().catch(() => undefined);
  await expiryHandles?.queue.close().catch(() => undefined);
  await auditHandles?.worker.close().catch(() => undefined);
  await auditHandles?.queue.close().catch(() => undefined);
  await bullConnection.quit().catch(() => undefined);
  await redis.quit().catch(() => undefined);
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
