# ADR-0002: Async grant ingestion via Kafka with at-least-once delivery

- **Status:** Accepted
- **Date:** 2026-05-15
- **Deciders:** Project lead

## Context

CSV uploads to `POST /api/ingest/grants` can carry 50K–500K rows during the
nightly RAMP reconciliation. Three failure modes had to be addressed:

1. **Long-running synchronous handlers** — a 500K-row upload took >25s
   under the old design, blocking the HTTP request and risking ALB
   timeouts.
2. **Partial failure visibility** — if upsert failed on row 47,238 of
   100K, the client received "500 Internal Server Error" with no way to
   know which rows succeeded.
3. **Backpressure** — multiple concurrent uploads competed for the same
   Postgres connections; the dashboard read path degraded under bulk write
   load.

Alternatives considered:

- **Synchronous upsert with chunked transaction** — simplest, but does
  nothing for backpressure and still ties the HTTP request to the full
  upload duration.
- **Background worker reading directly from S3** — decouples ingest from
  HTTP entirely but requires an extra hop (client → S3 → worker) and S3
  costs/setup the project doesn't want.
- **Kafka (Redpanda) as a durable event bus** — chosen.

## Decision

**Async ingest pipeline: `POST /api/ingest/grants` validates the CSV,
produces one `grant.batch.received` event per 500-row batch to Redpanda,
and responds `202 {jobId}` immediately. The `ingest-worker` consumes the
topic and performs the actual Postgres upserts.**

Concretely:

- One Kafka consumer group (`ingest-worker-group`). Each batch is keyed by
  `jobId` so cross-batch ordering within a job is preserved.
- **At-least-once delivery** — kafkajs default. Safe because `upsertBatch`
  is idempotent: dimension tables use `INSERT ... ON CONFLICT (natural_key)
  DO NOTHING/UPDATE`; grants dedup on the stable `grantNumber` when present
  (`ON CONFLICT ("grantNumber") DO UPDATE`), and fall back to a partial
  unique index `(title, piId) WHERE "grantNumber" IS NULL` for legacy rows.
- **Job status in Redis** — `initJob` reserves a slot, `recordBatchResult`
  advances `batchesDone`, `finalizeJob` writes the final `totalBatches`
  count. Polled via `GET /api/ingest/jobs/:id`.
- **Failed batches** — retried with exponential backoff (250ms → 500ms →
  1s). After exhaustion, routed to `grant.batch.dlq` + `grant.failed`
  topics; the job still advances so the polling client never hangs.

## Consequences

**Positive:**
- Decoupled HTTP duration from upsert duration. Live e2e bench:
  `upload → completed` p50 = 2.7s for 4K-row jobs at concurrency 20
  (`docs/BENCHMARKS.md`).
- Partial-failure observability — DLQ + `grant.failed` event preserve the
  failing batch with attempt count and error message.
- Independent scaling of api vs worker. Heavy nightly batch processing
  spreads across worker replicas while the api keeps serving reads.

**Negative:**
- Added an event bus (Redpanda) to the runtime — one more thing to monitor
  and operate. Mitigated by choosing Redpanda for its single-binary
  simplicity vs Kafka's Zookeeper/Kraft topology.
- At-least-once delivery means downstream consumers must be idempotent.
  Currently only `ingest-worker` consumes; if a notification consumer is
  added later, it must dedupe by `(jobId, batchIndex)`.

**Neutral:**
- The Redis job-store is a separate point of truth from Kafka topic state.
  This is the standard pattern for "client-poll the result of an async
  job" but introduces a small consistency window between
  `recordBatchResult` and the next poll. Acceptable for our 1Hz poll
  cadence.
