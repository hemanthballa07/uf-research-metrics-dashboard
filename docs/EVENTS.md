# Event-Driven Ingestion

The grant-ingestion path is decoupled from the HTTP request. `POST /api/ingest/grants`
validates and batches the uploaded CSV, produces batch events to Kafka, and returns
`202 { jobId, batches }`. A standalone `apps/ingest-worker` consumer group performs the
upserts and writes job progress to Redis; the frontend polls `GET /api/ingest/jobs/:id`
until the job is `completed`.

```
            POST /api/ingest/grants                 consume + upsert
  Browser ───────────────────────▶ API ──Kafka──▶ ingest-worker ──▶ Postgres
     ▲          202 {jobId}         │  grant.batch.received   │
     │  poll GET /ingest/jobs/:id   │                         │ progress
     └──────────────────────────────┘◀───────Redis (job)──────┘
```

## Transport

- **Broker:** Redpanda (Kafka-compatible single binary) in `docker-compose.yml`, with dual
  advertised listeners — `redpanda:9092` (internal, for in-compose services) and
  `localhost:19092` (external, for host-based `pnpm dev`). `KAFKA_BROKERS` selects the
  listener per process.
- **Client:** `kafkajs`, wrapped in `packages/events` (`getProducer`, `createConsumer`).

## Topics

| Topic | Direction | Purpose |
|---|---|---|
| `grant.batch.received` | API → worker | A batch of validated CSV rows to upsert. |
| `grant.ingested` | worker → observers | A batch was upserted successfully. |
| `grant.failed` | worker → observers | A batch failed after exhausting retries. |
| `grant.batch.dlq` | worker → DLQ | The dead-lettered batch payload + error/attempts. |

Consumer group: **`ingest-workers`** (scale by adding worker replicas; the group rebalances
partitions across them).

## Message envelopes

Every message is a Zod schema in `packages/events/src/envelopes.ts`, validated by both the
producer and the consumer. Grant rows reuse `csvGrantRowSchema` from `packages/shared`; its
`z.coerce.date()` fields survive the JSON round-trip (Date → ISO string on serialize → Date
on parse).

- `grantBatchReceivedSchema`: `{ jobId, batchIndex, totalBatches, rows: CsvGrantRow[] }`
- `grantIngestedSchema`: `{ jobId, batchIndex, inserted, updated }`
- `grantFailedSchema`: `{ jobId, batchIndex, error, attempts }`
- `grantBatchDlqSchema`: `grantBatchReceived` + `{ error, attempts }`

## Partitioning & ordering

Batches are produced with the **partition key = `jobId`**. All batches of one job therefore
land on a single partition and are processed sequentially by one consumer. This is what makes
the GET-modify-SET job update in `recordBatchResult` (Redis) safe without a lock — there is no
concurrent writer for a given job.

## Delivery semantics

**At-least-once + idempotent consumer.** The worker subscribes with `fromBeginning: true`, so
a freshly-joined consumer group never drops batches produced during its initial
join/rebalance. Reprocessing the same batch is safe because `upsertBatch` (`packages/db`) is
idempotent: it uses `INSERT ... ON CONFLICT ... DO UPDATE`, so a replayed batch updates rather
than duplicates rows. Insert-vs-update is detected via `(xmax = 0)`.

## Retries & dead-lettering

Per batch, the worker retries up to `INGEST_MAX_ATTEMPTS` (default 3) with exponential backoff
(250ms, 500ms, …). On exhaustion it:

1. produces the batch to `grant.batch.dlq` with the error + attempt count,
2. produces a `grant.failed` event,
3. advances the job (records a zero-row result) so the polling client never hangs — the
   failure is observable via the DLQ / `grant.failed`.

Unparseable (poison) messages are logged and skipped so they cannot wedge the partition.

> Naming: this Kafka **DLQ topic** is distinct from BullMQ's **failed-jobs queue** used by the
> expiry notifier below — different mechanisms, do not conflate.

## Job store (Redis)

`packages/events/src/jobStore.ts` holds the `IngestJob` lifecycle: `queued → processing →
completed`, with `inserted` / `updated` / `batchesDone` counters and any row-level validation
errors found at produce time. Keyed `ingest:job:<jobId>`, 24h TTL. The API status endpoint
reads it; the worker advances it via `recordBatchResult`.

## Worker metrics

The worker is a separate process and cannot mutate the API's in-process counters, so it
exposes its own `prom-client` registry on `:3003/metrics` (scraped by `prometheus.yml`):

- `ingest_rows_processed_total{result}` — inserted / updated / error
- `ingest_batches_processed_total{result}` — ok / dlq / error
- `expiry_scans_total{result}` / `expiry_notifications_total{result}` — see below

## Nightly expiry notifications (BullMQ)

Co-located in `apps/ingest-worker`, a BullMQ queue (`expiry-notifications`) runs a repeatable
scan at **07:00 America/New_York** (`cron 0 7 * * *`, tz pinned). The scan is registered with
`upsertJobScheduler('expiry-scan', …)`, which is idempotent on the scheduler id — worker
restarts refresh the schedule rather than stacking duplicate schedulers.

Each scan calls `getExpiringGrants()` (`packages/db`) and enqueues one `notify-expiry` job per
expiring grant (`attempts: 3`, exponential backoff). The handler is a structured-log stub
documented as a pluggable sink — swap it for an email/Slack client when one exists. Jobs that
exhaust their retries land in BullMQ's failed-jobs queue.

BullMQ uses a **dedicated** ioredis connection (`maxRetriesPerRequest: null`) — it issues
blocking commands, so it must not share the worker's job-store/cache client.

## Testing

The default `vitest run` is intentionally **Kafka-free** — it unit-tests `parseCsvToBatches`
and `upsertBatch`, with no broker dependency. The Kafka round-trip is a **separate, opt-in
target**:

```bash
docker compose up -d redpanda postgres redis
pnpm --filter @uf-research-metrics-platform/ingest-worker test:integration
```

`apps/ingest-worker/test/roundtrip.integration.test.ts` produces a `grant.batch.received`
event, consumes it through the real `handleBatch`, and asserts the row lands in Postgres and
the job reaches `completed`. It is wired only into a dedicated CI job that runs a `redpanda`
service.
