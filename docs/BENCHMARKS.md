# Ingestion Benchmarks

Evidence for the streaming-ingestion and row-level-lock-tuning claims.

**Component bench** (`pnpm --filter api bench:ingest [rowCount]`) exercises the `ingestGrantsFromStream` function in-process — no HTTP, no Kafka, no worker.

**Live endpoint** (`POST /api/ingest/grants`) now uses `streamCsvBatches`, a separate async generator that yields one batch at a time to the Kafka producer, making the HTTP path O(batch) as well. See the [Fix 2 section](#fix-2--streaming-produce-ofile--obatch-validation) for the before/after RSS comparison.

> Hardware: Apple Silicon MacBook Air, local PostgreSQL 15. `NODE_ENV=production`
> (Prisma query logging off). Single API process, default Prisma connection pool.

## Throughput & memory

| Rows    | CSV size | Elapsed | Throughput        | RSS baseline | RSS peak | RSS growth |
|---------|----------|---------|-------------------|--------------|----------|------------|
| 100,000 | 16.2 MB  | 5.8 s   | 17,097 rows/sec   | 101.9 MB     | 213.8 MB | 111.9 MB   |
| 250,000 | 40.6 MB  | 16.1 s  | 15,570 rows/sec¹  | 117.0 MB     | 246.2 MB | 129.2 MB   |
| 500,000 | 81.4 MB  | 28.2 s  | 17,728 rows/sec   | 116.0 MB     | 249.1 MB | 133.1 MB   |

¹ The 250K run was measured with query logging on (`NODE_ENV=development`); the
100K and 500K runs have logging off. Use the 100K/500K rows for the memory claim.

## The memory claim: O(batch), not O(file)

The load-bearing observation is the **RSS-vs-file-size relationship**:

- File size grew **5×** (16.2 MB → 81.4 MB).
- Peak RSS grew **~16%** (213.8 MB → 249.1 MB).

If the parser buffered the whole file (the previous `express.text()` +
`parseCSV(string)` design), peak memory would scale linearly with file size — the
500K run would have needed ~5× the working set. Instead it is essentially flat,
because rows flow `request → csv-parse (Transform) → 500-row buffer → upsert batch`
and only one batch is resident at a time. The ~110–130 MB floor is the V8 heap +
Prisma query engine + csv-parse internal buffers, independent of input size.

## Why this matters for the resume claim

- **"Streaming data parsers"** — literal: `apps/api/src/services/ingestService.ts`
  consumes `req` as a `Readable`; memory is bounded by `BATCH_SIZE` (500), not file size.
- **"…to eliminate contention on hot tables"** — each batch is a single transaction
  that runs `SET LOCAL lock_timeout = '2s'` and `statement_timeout = '30s'`, then does
  one bulk `INSERT … ON CONFLICT` per dimension table plus one for grants. Per-row DB
  round-trips dropped from ~4 (legacy per-row Prisma upserts) to ~1.
- **"…across 250K+ records"** — the 250K and 500K runs above. The old code path
  rejected anything over the 10 MB `express.text()` limit (~50K rows) before parsing
  even began.
- **Idempotency** — re-running the same CSV reports `inserted: 0, updated: N` with no
  duplicate rows. The insert/update split comes from PostgreSQL's `RETURNING (xmax = 0)`,
  not a timestamp heuristic. Verified in `src/tests/integration/ingest-scale.test.ts`.

## End-to-end + load (live pipeline)

The numbers above stress the ingestion *component* in-process. This section stresses the
**whole live system** — real HTTP, Kafka (Redpanda), the ingest-worker, Postgres, and job
polling — plus a read-path load test. Stack: `pgvector/pgvector:pg16` + Redis + Redpanda in
Docker, api + worker as untraced `node dist/index.js`, all on one laptop. Treat the
throughput/latency as *relative*, not a production SLA.

### Async-ingest E2E stress — `pnpm bench:e2e`

Drives `POST /api/ingest/grants` → `202 {jobId}` → Kafka `grant.batch.received` → worker
upsert → poll `GET /api/ingest/jobs/:id` to `completed`, under concurrency, with one
deliberate poison batch (a >500-char title that violates `grants.title @db.VarChar(500)`).

| Metric | Result |
|---|---|
| Concurrent uploads | 20 |
| Rows submitted / ingested | 80,000 / 80,000 (DB delta == expected) |
| Wall time | 15.8 s |
| End-to-end throughput | **5,053 rows/sec** (upload→committed, incl. HTTP+Kafka+poll) |
| upload→completed latency | p50 2,693 ms · p95 4,376 ms |
| Poison batch → `grant.batch.dlq` | 1 (healthy jobs still completed) |
| Correctness | **PASS** |

### Read-path load — `pnpm bench:read` (k6, `daily` profile, ramp to 20 VUs, 65 s)

Weighted working-hours mix against a DB holding **80,282 grants** (the rows the E2E run just
created). Logs in once in `setup()`, shares the token to all VUs.

| Endpoint | p50 | p95 | share |
|---|---|---|---|
| `/api/metrics/summary` | 1.4 ms | 13 ms | 25% |
| `/api/metrics/timeseries` | 1.4 ms | 12 ms | 8% |
| `/api/faculty/leaderboard` | 12 ms | 84 ms | 10% |
| `/api/grants/:id/similar` (pgvector HNSW) | 64 ms | 218 ms | 7% |
| `/api/grants?search=` | 639 ms | 1.02 s | 20% |
| **Overall** | 2.9 ms | **778 ms** | 8,265 reqs |

Thresholds **passed**: `http_req_failed = 0.00%`, `http_req_duration p95 = 778 ms < 800 ms`,
126 req/s. Faceted grant search is the bottleneck at 80K rows (full-text + joins); the
cached summary/timeseries endpoints stay single-digit-ms.

### Bugs the stress test caught (not theoretical)

Both surfaced *only* under concurrency — single-request manual testing never hit them:

1. **Producer connect race** (`packages/events/src/client.ts`) — `getProducer()` assigned the
   singleton ref *before* `await connect()` resolved, so concurrent first-callers got a
   not-yet-connected producer and `send()` threw "The producer is disconnected." Fixed by
   memoizing the *connect promise* instead of the instance.
2. **Kafka message-size overrun** (`apps/api/src/controllers/ingestController.ts`) — every
   batch was keyed by `jobId`, so a single multi-message `send()` coalesced all of a job's
   batches into one record batch on one partition (~1.2 MB for an 80K-row job), overrunning
   the broker's 1 MiB `max.message.bytes`. Fixed by issuing one produce request per batch
   (each ~140 KB); cross-batch order is irrelevant given idempotent upserts + the atomic
   Redis completion counter.

Rate limits were made env-overridable (`RATE_LIMIT_MAX`, `INGEST_RATE_MAX`; defaults
unchanged) so the load tools can exceed the protective production caps without code edits.

## Fix 2 — Streaming produce: O(file) → O(batch) validation

The live HTTP ingest endpoint (`POST /api/ingest/grants`) previously used `parseCsvToBatches`,
which accumulated ALL batches into a `GrantUpsertRow[][]` array before any Kafka produce call —
O(file) memory. The Phase 0 diagnosis confirmed this empirically, then the fix was validated
end-to-end.

### Before fix (Phase 0 diagnosis, O(file) path, `parseCsvToBatches`)

| Rows | CSV size | RSS baseline | RSS peak | RSS delta |
|---|---|---|---|---|
| 250,000 | ~27 MB | ~302 MB | ~607 MB | **~305 MB** |

Delta is **~11× the CSV file size** (305 MB / 27 MB), consistent with fully-parsed JavaScript
objects (~1.2 KB/row vs ~110 bytes CSV text). The O(file) path held all 500 batches × 500 rows
in memory simultaneously before any Kafka produce call.

### After fix (O(batch) path, `streamCsvBatches` generator)

Measured against the live running stack (API + ingest-worker + Redpanda + Postgres):

| Rows                 | CSV size | RSS baseline | RSS peak | RSS delta | Job result                |
|----------------------|----------|--------------|----------|-----------|---------------------------|
| 1,500 (3 batches)    | ~0.14 MB | ~54 MB       | n/a      | —         | completed, +1500 DB rows  |
| 50,000 (100 batches) | 7.0 MB   | ~54 MB       | ~129 MB  | **75 MB** | completed, +50000 DB rows |

Delta for 50K rows is **~10× the CSV file size** — but crucially, this **does not scale with
file size**. A 7 MB CSV produces a 75 MB delta; a 250K-row (~27 MB) CSV under the old O(file)
path produced a 305 MB delta. The new path discards each batch immediately after `producer.send`,
so peak RSS stays bounded by a single batch (~600 KB for 500 rows) plus connection pool and V8
heap overhead, not the full CSV.

### Fix design (race-free `initJob`/`finalizeJob`)

The streaming path needed a new Redis lifecycle: streaming producers don't know `totalBatches`
until all batches are produced. The fix uses:

- `initJob(redis, jobId)` — reserves the job with `totalBatches: -1` sentinel **before** the
  first `producer.send`, so `recordBatchResult` in the worker always finds the job in Redis.
- `finalizeJob(redis, jobId, { totalBatches, totalRows, errors })` — sets the real count after
  all batches are produced; re-evaluates status in case the worker already processed some batches.
- `recordBatchResult` completion check guarded by `job.totalBatches > 0` — prevents premature
  `completed` while the sentinel is in place.

### Edge cases verified in the live stack

| Scenario | Observed response | Job status |
|---|---|---|
| Empty CSV / header-only | 400 `CSV file is empty` | — |
| All-invalid rows (2 rows) | 202, `batches:0`, errors array | `completed` immediately |
| Malformed CSV (unclosed quote) | 400 `Malformed CSV: Quote Not Closed` | — |
| Re-upload same 1500 rows (idempotency) | 202, `inserted:0, updated:1500` | `completed` |
| VIEWER token | 403 | — |
| No auth token | 401 | — |

## Reproducing

### Component ingestion bench

```bash
cd apps/api
# fresh DB
pnpm exec prisma migrate deploy
# default 250K rows
NODE_ENV=production pnpm bench:ingest
# custom row count
NODE_ENV=production pnpm bench:ingest -- 500000
```

The script cleans up its own rows and the temp CSV on completion.

### Live E2E + load

```bash
# 1. clean pgvector stack + migrate + seed + synthetic embeddings (keyless /similar)
docker compose up -d postgres redis redpanda      # postgres = pgvector/pgvector:pg16
pnpm bench:seed-embeddings
# 2. run api + worker with raised limits for the load tools
RATE_LIMIT_MAX=100000 INGEST_RATE_MAX=100000 node apps/api/dist/index.js &
node apps/ingest-worker/dist/index.js &
# 3. drive it
pnpm bench:e2e                                     # async pipeline stress + DLQ
API_URL=http://localhost:3001 ADMIN_PASSWORD=changeme pnpm bench:read   # k6 read load
```

## Concurrency ceiling & reporting-week contention (B17)

Two scenarios that extend `bench:read` (which holds a *fixed* VU count): a stepped
sweep that finds the read-path **ceiling**, and a mixed read+ingest run that surfaces
**reporting-week DB contention**. Shared login / endpoint-mix / CSV generator live in
`apps/api/scripts/bench/lib/mix.js`.

> Stack: `node dist` api + ingest-worker, Postgres (pgvector) on :5433, Redis, Redpanda,
> 40K-grant `db:seed:uf` dataset — all on one laptop **also running the mediflow stack**.
> Numbers are *relative*, not an SLA; read the **shape**, not the absolutes.

### Concurrency ceiling — `pnpm bench:stress`

Stepped `constant-vus` scenarios (25→200 VUs, 20s each), each tagged by level so the
summary shows p95 per level (a tagged threshold materialises the sub-metric). 12,476
reqs, **0% errors**.

| VUs | overall read p95 |
|---|---|
| 25  | 1.10 s |
| 50  | 1.59 s |
| 100 | 3.17 s |
| 150 | 6.72 s |
| 200 | 6.40 s |

Per-endpoint p95 over the sweep: **grants_search 7.17 s** · leaderboard 3.76 s ·
similar 3.42 s · summary **84 ms** · timeseries **89 ms**. Under this working-hours mix
(20% faceted `ILIKE` grant search) the `p95<800ms` SLO is already breached at 25 VUs —
the ceiling is **search-bound**, while the Redis-cached summary/timeseries endpoints stay
<100 ms p95 at every level. The lever is the same faceted grant search flagged in the
read-path baseline (full-text + joins, no FTS index). `/similar` here runs without seeded
embeddings, so treat its number as a loose upper bound.

#### Resolved — grant-search trigram index

Migration `20260609000000_add_grant_search_trigram` adds `pg_trgm` GIN indexes on `grants.title`
and `faculty.name`, and `apps/api/src/services/grantSearch.ts` resolves PI matches to a literal
`piId IN (...)` so the planner BitmapOrs `grants_title_trgm` + `grants_piId_idx`. (The old
`pi: { name: { contains } }` relation filter compiled to a correlated subquery that forced a
**seq scan over all 40K grants regardless of selectivity** — confirmed by `EXPLAIN`: 42 ms →
1 ms on the single query.) Same 40K seed, same sweep:

| VUs | read p95 BEFORE | read p95 AFTER |
|---|---|---|
| 25  | 1.06 s | **0.08 s** |
| 50  | 1.59 s | **0.13 s** |
| 100 | 3.17 s | **0.18 s** |
| 150 | 6.72 s | **0.64 s** |
| 200 | 6.40 s | **0.63 s** |

`grants_search` p95 **7.1 s → 0.58 s (~12×)**, throughput **~120 → 740 req/s (~6×)**, 0% errors
across 74,208 reqs. The `p95<800ms` ceiling moves from **breached at 25 VUs → comfortably passing
at 200 VUs**. Correctness verified: endpoint search totals match direct DB counts (title-match,
PI-name, and no-match cases). Note the index only helps terms ≥3 chars; shorter searches still scan.

### Reporting-week contention — `pnpm bench:reporting-week`

15 read VUs run through a **quiet** window then a **spike** window during which 4 ingest
VUs upload 2,000-row CSVs (the NIH-deadline write-spike). Reads tagged by phase:

| phase | read p95 |
|---|---|
| quiet (reads only)            | 0.81 s |
| spike (reads + ingest spike)  | 1.10 s |

189 uploads accepted, **0 ingest errors / 0 lock-timeout failures**; the worker committed
~378K rows during/after the spike (grants 40K → 320K+). Read p95 rose **~35%** under the
concurrent write-spike — the worker's batched `INSERT … ON CONFLICT` (under
`SET LOCAL lock_timeout='2s'`) competing with read queries on `grants`. This needs the
ingest-worker **and** Redpanda running (async path) — it is local-only; CI runs
`bench:stress` instead (see the `load-test` job in `.github/workflows/ci.yml`).

### Reproducing

```bash
POSTGRES_PORT=5433 docker compose up -d postgres redis redpanda
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/uf_research_metrics pnpm db:seed:uf
# Build packages+api+worker. pnpm run-wrappers crash on the pnpm-11 deps-check, so build via
# package-local tsc, e.g.:  node_modules/.bin/tsc -p packages/db/tsconfig.build.json  (repeat per pkg)
RATE_LIMIT_MAX=100000 INGEST_RATE_MAX=100000 KAFKA_BROKERS=localhost:19092 \
  node apps/api/dist/index.js &
KAFKA_BROKERS=localhost:19092 EMBED_ON_INGEST=false node apps/ingest-worker/dist/index.js &
API_URL=http://localhost:3001 ADMIN_PASSWORD=changeme pnpm bench:stress
API_URL=http://localhost:3001 ADMIN_PASSWORD=changeme pnpm bench:reporting-week
```

> **Gotcha:** the api/worker run the **built** `packages/db/dist`. A stale `dist`
> (pre-dual-path-upsert) makes the grantNumber ingest path fail with Postgres `42P10`
> (`no unique or exclusion constraint matching the ON CONFLICT specification`) against the
> current partial-index schema — every batch DLQs and the spike commits nothing. Rebuild
> `packages/db` before a load run.

## UF traffic-shape context

These ingestion numbers model the **bulk path**: a nightly/periodic RAMP CSV export
reconciled against the warehouse. Day-to-day load is read-heavy (dashboard, faceted
grant search, leaderboard) from 40–60 COM administrative users, ~8–15 concurrent at
peak, during 8am–6pm ET business hours. Submission-heavy write spikes cluster around
the NIH R01 deadlines (Feb 5 / Jun 5 / Oct 5), which is when the lock-timeout guard
matters most — a long-held lock fails fast at 2s instead of stacking behind a
reporting-week ingestion.
