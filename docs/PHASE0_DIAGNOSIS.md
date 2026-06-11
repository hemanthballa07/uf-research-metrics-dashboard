# Phase 0 Diagnosis — Read-Only Measurement Pass

**Date:** 2026-05-20  
**Stack:** ragstress (pgvector/pgvector:pg16, 120,283 rows), API built from current `main`, Redpanda on 19092, Redis on 6379.  
**Scope:** Three hypotheses about known performance/correctness gaps, measured before any fix.

---

## Diagnostic 1 — Is the slow search a title scan, a join, or the count?

### Hypothesis
The p95 ≈ 1.02s on `GET /api/grants?search=` is caused by a full table scan — unclear whether the `title ILIKE`, the PI join, or the `COUNT(*)` dominates.

### Method
Captured actual Prisma-emitted SQL via `NODE_ENV=development` logging, then ran `EXPLAIN (ANALYZE, BUFFERS)` on both queries against ragstress (120,283 rows).

### Actual SQL (Prisma-emitted)

**Count query:**
```sql
SELECT COUNT(*) FROM (
  SELECT grants.id FROM grants
  LEFT JOIN faculty AS j1 ON j1.id = grants."piId"
  WHERE (grants.title ILIKE $1 OR (j1.name ILIKE $2 AND j1.id IS NOT NULL))
  OFFSET 0
) AS sub
```

**Data query:**
```sql
SELECT grants.* FROM grants
LEFT JOIN faculty AS j1 ON j1.id = grants."piId"
WHERE (grants.title ILIKE $1 OR (j1.name ILIKE $2 AND j1.id IS NOT NULL))
ORDER BY grants."submittedAt" DESC LIMIT 10 OFFSET 0
```

### Query Plans

| Query | Execution time | Dominant node | Rows removed by filter |
|---|---|---|---|
| Count | 92.6 ms | Seq Scan on grants (2,056 blocks) | 120,270 / 120,283 |
| Data | 88.4 ms | Seq Scan on grants (2,056 blocks) | 120,270 / 120,283 |

Both plans: **Hash Left Join with a grants seq scan as the outer input**. The faculty join is trivial — 61 rows, 2 blocks, negligible cost. Count and data queries are nearly equal in cost.

### Index Inventory

**`grants` table:** B-tree indexes on piId, sponsorId, status, submittedAt, awardedAt, endAt. **No text index on `title`.** Unique B-tree on `(title, piId)`.

**`faculty` table:** B-tree on email (unique). **No index on `name`.**

**`pg_trgm`:** Available (`default_version=1.6`) but **not installed** in ragstress.

### Extrapolation to 250K production scale

Seq scan is O(N). At 250K/120K ≈ 2.1× rows → ~190–200 ms per query, two queries = ~400 ms before network overhead. From the load-test baseline (80K rows, p95 1.02s): 250K/80K ≈ 3.1× → ~280 ms per query, ~560 ms for both — likely pushing p95 above 1s even if caching is warm.

### Would a trigram index on `title` fix it?

Partially. A GIN trigram index on `grants.title` enables a bitmap index scan for the `ILIKE` predicate. But the OR condition with `faculty.name ILIKE` spans a joined table — the planner must still check rows that match via PI name even when the title doesn't match. A trigram index on `title` alone leaves the `pi.name` predicate as a seq scan. You need GIN trigram indexes on **both** `grants.title` and `faculty.name`; even then, the OR join may still force a full scan for terms with low selectivity.

### Verdict: CONFIRMED

The dominant cost is the `grants` seq scan + ILIKE filter. The PI join is trivial. Count and data queries are equally expensive. Fix requires `pg_trgm` + GIN indexes on both `grants.title` and `faculty.name`, or a full-text search column.

---

## Diagnostic 2 — Does the LIVE ingest endpoint use O(file) or O(batch) memory?

### Hypothesis
The live HTTP endpoint (`parseCsvToBatches` in `ingestController.ts`) buffers all batches before producing to Kafka, unlike the O(batch) `ingestGrantsFromStream` measured in `docs/BENCHMARKS.md`.

### Method
Built API (`pnpm --filter api build`), started in production mode against ragstress. Generated a 250K-row CSV (~27 MB). Sampled RSS at ~200ms intervals before, during, and after a single `POST /api/ingest/grants`.

### Results

| Measurement | RSS |
|---|---|
| Baseline (API at rest, pre-upload) | ~302 MB |
| Peak (during upload) | ~607 MB |
| **Delta** | **~305 MB** |
| Post-upload (V8 GC reclaimed) | ~62 MB |

API response: `{"status":"queued","totalRows":250000,"batches":500,"errors":[]}`

### Analysis

`parseCsvToBatches` (`apps/api/src/services/ingestService.ts:32-80`) pushes every validated row into a growing `batches: GrantUpsertRow[][]` array and returns only when the entire stream is consumed. For 250K rows: 500 batches × 500 rows = 250,000 rows held simultaneously in memory before any Kafka produce call. The ~305 MB growth is **~11× the 27 MB CSV file size**, consistent with fully-parsed JavaScript objects (~1.2 KB/row vs ~110 bytes CSV text).

**Comparison to O(batch) benchmark** (`ingestGrantsFromStream`, 250K rows, `docs/BENCHMARKS.md:16`): that path showed peak 246.2 MB total (delta ~129 MB from its baseline). The live endpoint delta of ~305 MB is **2.4× higher** with all data resident simultaneously.

**Postgres write/lock bottleneck during upload:** None — in the async design the API only produces to Kafka during upload; no Postgres writes occur until the ingest-worker processes the messages.

**Projection to 500K rows (~81 MB CSV):** O(file) delta scales proportionally: expected ~610 MB delta, potentially triggering Node.js OOM on a constrained process.

### Verdict: CONFIRMED

The live endpoint is O(file). The benchmark measured `ingestGrantsFromStream` (O(batch), not used by the HTTP path). Fix: replace `parseCsvToBatches` in `ingestController.ts` with a streaming produce loop — parse one batch, produce it to Kafka, discard, repeat — so peak RSS stays bounded by `BATCH_SIZE` (500 rows) rather than the full file.

---

## Diagnostic 3 — Worker offset-commit semantics (at-least-once or loss window?)

### Hypothesis
kafkajs autoCommit may commit offsets on a timer before `handleBatch` durably completes, creating a message-loss window.

### Method
Read `apps/ingest-worker/src/index.ts`, `apps/ingest-worker/src/handler.ts`, `packages/events/src/client.ts`.

### Findings

**Consumer creation** (`packages/events/src/client.ts:41-43`):
```ts
return getKafka().consumer({ groupId, allowAutoTopicCreation: true });
```
No `autoCommit`, `autoCommitInterval`, or `autoCommitThreshold` passed → kafkajs defaults: `autoCommit: true`, `autoCommitInterval: 5000 ms`.

**Message processing** (`apps/ingest-worker/src/index.ts:35-50`): uses `eachMessage` with no autoCommit override. The handler `await handleBatch(...)` completes synchronously per message per partition before kafkajs fetches the next message.

**kafkajs `eachMessage` commit semantics:** kafkajs marks an offset "ready to commit" only **after the `eachMessage` handler resolves**. The 5-second autoCommit timer can only flush offsets already marked ready — it cannot commit the offset of an in-flight handler. Therefore:

| Scenario | Outcome |
|---|---|
| Worker crashes mid-`handleBatch` | Offset not committed → message redelivered |
| Worker crashes after handler resolves, before 5s timer | Offset not committed → message redelivered |
| Handler throws → retries exhaust → DLQ path | Offset committed after DLQ producer sends |

**Loss window:** None. The offset of the current message is committed only after `handleBatch` completes successfully (or routes to DLQ). There is no path where a message is committed before processing finishes.

**Redelivery on crash:** Safe. `upsertBatch` is idempotent: `ON CONFLICT (title, "piId") DO UPDATE … RETURNING (xmax = 0)` (`packages/db/src/upsert.ts:188-197`). Double-applying a batch inserts nothing and updates existing rows — correct in both cases.

### Verdict: REFUTED (no loss window)

The guarantee is **true at-least-once**. A worker crash mid-batch causes redelivery, never silent data loss. Idempotent upsert makes redelivery safe. **No fix warranted.**

---

## Recommendation (ranked by ROI)

### 1. Fix Diagnostic 2 — Stream-produce the live ingest endpoint (HIGH ROI)

Replace `parseCsvToBatches` in `ingestController.ts` with a streaming produce loop: parse one BATCH_SIZE chunk → produce one Kafka message → discard → next chunk. This makes the live HTTP path O(batch) like the benchmark, eliminating the ~305 MB memory spike for 250K uploads and preventing OOM at 500K+ rows. The fix is surgical (change in `ingestController.ts`); the `202 {jobId}` contract and Kafka topic schema are unchanged.

### 2. Fix Diagnostic 1 — Search index (MEDIUM ROI)

Install `pg_trgm` and add GIN indexes on `grants.title` and `faculty.name`. For terms with good selectivity this will drop search from ~90ms to single-digit ms. For low-selectivity terms (common words), the planner may fall back to seq scan — a more complete fix wraps both fields in a `tsvector` GIN index and rewrites the WHERE clause to use `@@` full-text operators, which the planner can always index-scan. At 250K production scale the current path extrapolates to ~400–560ms before connection overhead, likely pushing p95 search above 1s.

### 3. No action for Diagnostic 3

Worker commit semantics are correct at-least-once. The 5-second autoCommit window creates redelivery risk (not loss), and idempotent upserts make that safe. Switching to `eachBatch` + manual `resolveOffset` would shorten the redelivery window but adds complexity for no practical gain at current scale.
