# ADR-0003: Stream-produce CSV batches to Kafka for constant-memory uploads

- **Status:** Accepted
- **Date:** 2026-05-20
- **Deciders:** Project lead

## Context

ADR-0002 established the async ingest pipeline but kept a hidden memory
ceiling: the original `parseCsvToBatches` function accumulated every batch
into a `GrantUpsertRow[][]` array *before* any `producer.send` call. A
Phase-0 diagnosis (`docs/PHASE0_DIAGNOSIS.md`) confirmed empirically:

| Rows | CSV size | RSS baseline | RSS peak | RSS delta |
|---|---|---|---|---|
| 250,000 | ~27 MB | ~302 MB | ~607 MB | **~305 MB** |

Delta scales linearly with file size (~11× the CSV bytes, consistent with
parsed JS objects at ~1.2 KB/row). A 500K-row RAMP export would exceed
600 MB resident set, hitting the api pod's `memory: 512Mi` limit and
OOM-killing the process before the first batch even reached Kafka.

## Decision

**Replace `parseCsvToBatches` with `streamCsvBatches` — an async generator
that yields one validated batch at a time. The controller calls
`producer.send` per yielded batch and discards each batch immediately
after produce, so peak RSS is O(BATCH_SIZE × row_size), constant in the
file size.**

Concretely:

- `apps/api/src/services/ingestService.ts:streamCsvBatches` returns
  `AsyncGenerator<GrantUpsertRow[]>`. Backpressure is automatic: the
  generator only yields when the producer's send is awaited.
- The job lifecycle in Redis needed reworking because `totalBatches` is
  unknown at produce-start time:
  - `initJob(jobId)` — reserves a Redis slot with sentinel
    `totalBatches: -1` *before* the first `producer.send`. Prevents the
    worker's `recordBatchResult` from premature `completed` status.
  - `finalizeJob(jobId, { totalBatches, totalRows, errors })` — sets the
    real count after the last batch is produced. Re-evaluates job status
    in case the worker already processed every batch.
  - `recordBatchResult` completion check is now guarded by
    `job.totalBatches > 0` so it never marks `completed` while the
    sentinel is in place.

## Consequences

**Positive (measured):**
- 50K-row (7 MB CSV) upload: peak RSS delta = 75 MB. Down from a
  projected ~85 MB under the old design — but more importantly, **does
  not scale with file size**. A 500K-row CSV produces approximately the
  same delta as a 50K-row CSV (`docs/BENCHMARKS.md` Fix-2 table).
- HTTP body limits no longer constrain valid file sizes. The old
  `express.text({ limit: '10mb' })` rejected anything over ~50K rows
  before parsing began; the streaming path has no upper bound beyond
  Kafka broker max message size (handled by per-batch sends, ~140 KB
  each).

**Negative:**
- The `initJob`/`finalizeJob` lifecycle adds two extra Redis round trips
  per upload. Negligible at <1s p50 for the entire upload but worth
  noting if Redis ever becomes the bottleneck.
- Producer connect-promise memoization had to be added separately
  (concurrent first-callers used to receive a not-yet-connected producer
  and `send()` would throw). Documented in `packages/events/src/client.ts`.

**Neutral:**
- The component-level bench (`pnpm bench:ingest`) was always O(batch)
  because it consumed the input as a `Readable`. The fix brought the live
  HTTP path into parity with what the benchmark already showed.
