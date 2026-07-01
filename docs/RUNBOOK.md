# Runbook - Operations Guide

## Common Operations

### Starting the Application

#### Docker (Recommended)
```bash
docker compose up
```
Starts: PostgreSQL, Redis, API, Web, Prometheus, Grafana, Alertmanager.

After first boot, run migrations and seed:
```bash
docker compose exec api pnpm --filter api db:migrate
docker compose exec api pnpm --filter api db:seed
```

#### Non-Docker
```bash
# Terminal 1: Start API (requires PostgreSQL + Redis running locally)
pnpm --filter api dev

# Terminal 2: Start Web
pnpm --filter web dev
```

### Service URLs

| Service | URL | Default Credentials |
|---|---|---|
| Web app | http://localhost:3000 | admin@ufl.edu / changeme |
| API | http://localhost:3001 | — |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3002 | admin / admin |
| PostgreSQL | localhost:5432 | postgres / postgres |
| Redis | localhost:6379 | — |

### Database Operations

#### Reset Database
```bash
# Docker
docker compose exec api pnpm --filter api exec prisma migrate reset

# Non-Docker
pnpm --filter api exec prisma migrate reset
```

#### Run Migrations
```bash
# Docker
docker compose exec api pnpm --filter api db:migrate

# Non-Docker
pnpm db:migrate
```

#### Seed Database
```bash
# Creates admin@ufl.edu / changeme + sample grants
# Docker
docker compose exec api pnpm --filter api db:seed

# Non-Docker
pnpm db:seed
```

#### Open Prisma Studio
```bash
# Docker
docker compose exec api pnpm --filter api db:studio

# Non-Docker
pnpm db:studio
```

### Ingest Worker

The ingest pipeline is asynchronous. `POST /api/ingest/grants` validates + batches the CSV and
produces `grant.batch.received` events to Kafka; the **ingest-worker** consumes them and performs
the Postgres upserts. Without the worker running, jobs will be queued but never complete.

#### Starting the worker (non-Docker)

```bash
# Required env vars (in addition to DATABASE_URL):
# KAFKA_BROKERS=localhost:19092   (or redpanda:9092 in Docker)
# REDIS_URL=redis://localhost:6379
# EMBED_ON_INGEST=false           (skip embedding for bulk loads)

pnpm --filter ingest-worker start
```

#### Checking ingest job status

```bash
# Get a token first
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ufl.edu","password":"changeme"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# Poll a specific job
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/ingest/jobs/<jobId>
# Returns: { "status": "queued"|"processing"|"completed"|"failed", "totalBatches": N, "batchesDone": N, ... }
```

Job states:
- `queued` — batches produced to Kafka, worker hasn't started yet
- `processing` — worker is consuming batches
- `completed` — all batches upserted (or job had 0 valid rows)
- Worker crash → batch redelivered (at-least-once + idempotent upsert = safe)

### Viewing Logs

#### Docker
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f web
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f prometheus
docker compose logs -f grafana
```

#### Non-Docker
Logs are printed to the console where services are running.

## Authentication

### Getting a Token
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ufl.edu","password":"changeme"}'
# Returns: {"accessToken":"<jwt>","user":{"id":1,"email":"admin@ufl.edu","role":"ADMIN"}}
```

Tokens expire after 8 hours. Pass as `Authorization: Bearer <token>` on all `/api/*` requests (except `/api/health` and `/api/auth/login`).

### Creating a New User (via Prisma Studio or seed script)
Users are managed via the `users` table. Roles: `ADMIN` (write access) or `VIEWER` (read-only). Passwords are hashed with bcryptjs.

## Troubleshooting

### 401 Unauthorized on API Calls

**Cause:** Missing or expired JWT token.

**Solutions:**
1. Re-login to get a fresh token (web app redirects to `/login` automatically)
2. Check `Authorization: Bearer <token>` header is present in the request
3. Token TTL is 8 hours — re-authenticate if expired
4. Verify `JWT_SECRET` env var is set and consistent across restarts

### Database Connection Issues

**Problem:** API can't connect to database

**Solutions:**
1. Check `DATABASE_URL` in `.env` file
2. Verify PostgreSQL is running:
   ```bash
   # Docker
   docker compose ps postgres

   # Non-Docker
   psql -U postgres -c "SELECT 1"
   ```
3. Check database credentials match
4. Ensure database exists:
   ```bash
   createdb uf_research_metrics
   ```

### Redis Connection Issues

**Problem:** `redis` errors in API logs; cache not working

**Note:** Redis is best-effort. If unavailable, requests fall through to the database — the API keeps running. This is by design.

**Solutions:**
1. Check `REDIS_URL` in `.env` (default: `redis://localhost:6379`)
2. Verify Redis is running:
   ```bash
   # Docker
   docker compose ps redis

   # Non-Docker
   redis-cli ping   # should return PONG
   ```
3. Restart Redis: `docker compose restart redis`

### Cache Not Invalidating After Ingest

**Problem:** Old data served after CSV ingest

**Solutions:**
1. Check Redis is reachable (see above)
2. Manually flush cache: `redis-cli FLUSHDB`
3. Cache TTL is 5 minutes — old data expires automatically

### Prometheus / Grafana Not Showing Data

**Problem:** Grafana panels show "No data"

**Solutions:**
1. Verify Prometheus is scraping:
   - Open http://localhost:9090/targets
   - `api` target should show `UP`
2. Check API exposes metrics: `curl http://localhost:3001/api/metrics`
3. Verify datasource in Grafana: Settings → Data Sources → Prometheus → Test
4. Check `prometheus.yml` `scrape_configs` target matches API host/port

### Port Already in Use

**Problem:** Port 3000, 3001, 5432, 6379, or 9090 already in use

**Solutions:**
1. Find process using port:
   ```bash
   lsof -i :3001  # macOS/Linux
   netstat -ano | findstr :3001  # Windows
   ```
2. Kill the process or change port in `.env` / `docker-compose.yml`

### Prisma Client Not Generated

**Problem:** `PrismaClient` import errors

**Solution:**
```bash
pnpm --filter api exec prisma generate
```

### Migration Issues

**Problem:** Migration fails or database is out of sync

**Solutions:**
1. Check migration status:
   ```bash
   pnpm --filter api exec prisma migrate status
   ```
2. Reset and re-run migrations:
   ```bash
   pnpm --filter api exec prisma migrate reset
   pnpm --filter api exec prisma migrate dev
   ```

### Docker Issues

**Problem:** Containers won't start

**Solutions:**
1. Check Docker is running: `docker ps`
2. Rebuild containers:
   ```bash
   docker compose down
   docker compose build --no-cache
   docker compose up
   ```
3. Check logs: `docker compose logs`

### API Not Responding

**Problem:** API returns 503 or connection refused

**Solutions:**
1. Check API is running: `curl http://localhost:3001/api/health`
2. Check database connection (see Database Connection Issues)
3. Check API logs for errors
4. Verify `API_PORT` in environment matches request

### Web App Not Loading / Stuck on Login

**Problem:** Web app shows blank page or errors

**Solutions:**
1. Check browser console for errors
2. Verify `VITE_API_URL` matches API server URL
3. Check web server is running: `curl http://localhost:3000`
4. Clear browser localStorage (clears any corrupt token): DevTools → Application → Local Storage → Clear
5. Clear browser cache

### CSV Ingestion Fails

**Problem:** CSV upload returns errors

**Solutions:**
1. Verify CSV format matches expected schema
2. Check CSV has header row
3. Validate required fields are present
4. Check API logs for specific validation errors
5. Ensure dates are in valid format (YYYY-MM-DD)
6. Ingest endpoint is rate-limited to 10 requests/min per IP
7. If the upload returns 202 but the job stays `queued`, verify the ingest-worker is running and connected to the Kafka broker (`KAFKA_BROKERS` env var)
8. Check worker logs for `batch upsert failed` or `unparseable batch` errors

## Environment Variables

### Required Variables

**API**:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string (default: `redis://localhost:6379`)
- `JWT_SECRET` - Secret for signing JWT tokens (change in production)
- `API_PORT` - Port for API server (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `KAFKA_BROKERS` - Comma-separated broker addresses (e.g., `localhost:19092`)
- `RATE_LIMIT_MAX` - Global rate limit per IP (default: 100 req/min; set to 100000 for load testing)
- `INGEST_RATE_MAX` - Ingest endpoint rate limit per IP (default: 10 req/min; set to 100000 for load testing)

**Web**:
- `VITE_API_URL` - API server URL (default: http://localhost:3001)

**Database** (Docker):
- `POSTGRES_USER` - Database user (default: postgres)
- `POSTGRES_PASSWORD` - Database password (default: postgres)
- `POSTGRES_DB` - Database name (default: uf_research_metrics)

### Setting Up Environment

1. Copy example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your values (see `.env.example` for detailed comments)

3. For Docker, environment variables are auto-configured via `docker-compose.yml`. Override defaults by setting them in your shell or `.env` file.

## Performance Tuning

### Redis Cache
- Default TTL: 5 minutes for all metrics/insights routes
- Cache is invalidated on every successful ingest
- Monitor hit rate via Grafana "Cache Hit Rate" panel or `api_cache_hits_total` / `api_cache_misses_total` Prometheus counters

### Rate Limiting
- Global: 100 req/min per IP (returns 429 when exceeded)
- Ingest: 10 req/min per IP

### Database Performance
1. **Check slow queries**: Enable query logging in Prisma
2. **Add indexes**: Review query patterns and add indexes as needed
3. **Connection pooling**: Configure Prisma connection pool size

## Backup and Recovery

### Database Backup

```bash
# Docker
docker compose exec postgres pg_dump -U postgres uf_research_metrics > backup.sql

# Non-Docker
pg_dump -U postgres uf_research_metrics > backup.sql
```

### Database Restore

```bash
# Docker
docker compose exec -T postgres psql -U postgres uf_research_metrics < backup.sql

# Non-Docker
psql -U postgres uf_research_metrics < backup.sql
```

## Monitoring

### Health Checks

- API health (no auth): `GET /api/health`
- Prometheus metrics (no auth): `GET /api/metrics`
- Grafana dashboard: http://localhost:3002

### Alerts

Four Alertmanager rules are pre-configured:
1. **HighErrorRate** — >5% 5xx responses over 5 min
2. **HighP95Latency** — p95 latency >2s over 5 min
3. **IngestErrorSpike** — >10 ingest errors over 5 min
4. **APIDown** — API health check failing for >1 min

View active alerts: http://localhost:9090/alerts

### Logs

Monitor application logs for:
- Error rates
- Slow queries
- Failed requests
- Database/Redis connection issues
- 401 spikes (may indicate token expiry or attack)

## SLOs and Error Budget

Service-level objectives — what we promise the system delivers, and what
fraction of failure we accept before paging.

### Defined SLOs

| SLI                                                                      | Target | Window | Source |
|--------------------------------------------------------------------------|-----------------|---|---|
| API availability (non-5xx, all endpoints)                                | **99.9%** | rolling 28d | k6 daily profile: 0.00% failure over 65s/126 req/s |
| Read-mix p95 latency (`/api/metrics/*`, leaderboard, `/similar`, search) | **≤ 1.0s** | rolling 5m | k6 overall p95 = 778 ms with 800 ms threshold |
| Ingest job success (batches reach `completed`, not DLQ)                  | **99.5%** | rolling 7d | E2E stress: 1 DLQ in 80K rows (= 0.00125%) by design |
| Ingest end-to-end latency (upload → `completed`) p95                     | **≤ 8s** | for jobs ≤ 5K rows | E2E: p95 4.4s @ 20 concurrent uploads of 4K rows |

Recording rules in `recording.rules.yml` compute the SLI series:
`sli:availability_ratio:rate{5m,30m,1h,6h}`,
`sli:read_p95_seconds:rate5m`,
`sli:ingest_success_ratio:rate{30m,6h}`.

Each ratio uses `1 - (errors / clamp_min(total, 1e-12))` so at zero traffic
the SLI is 1.0 (not NaN) — Grafana stat panels stay clean overnight.

### Burn-rate alerts (in `alert.rules.yml`, group `uf-research-metrics-slo`)

Multi-window burn-rate alerting (Google SRE book convention): both a short
and a long window must agree before firing, so transient blips don't page.
A `min-traffic` guard (`sum(rate(http_requests_total[1h])) > 0.1`) prevents
off-hours single errors from triggering at <1 req/s.

| Alert | Burn factor | Windows | Severity | What it means |
|---|---|---|---|---|
| `AvailabilityBudgetBurnFast` | 14.4× | 5m AND 1h | critical | 2% of monthly budget in 1h — at this rate, budget exhausts in 50h |
| `AvailabilityBudgetBurnSlow` | 6× | 30m AND 6h | warning | 10% of monthly budget in 6h — investigate, no need to page |
| `ReadLatencyP95Breach` | n/a | 5m | warning | Read-mix p95 > 1.0s for 5m |
| `IngestSuccessBudgetBurnFast` | 14.4× | 30m AND 6h | critical | Ingest success rate < 99.5% (fast burn) |
| `APIDown` | n/a | 1m | critical | Prometheus can't scrape `/metrics` |

### Equivalence map (legacy alerts → new SLO alerts)

The old `HighErrorRate`, `HighLatencyP95`, `IngestErrorSpike` alerts are
preserved in `alert.rules.yml` group `uf-research-metrics-legacy` at
`severity: info` for a one-week transition. They carry a `superseded_by`
label so any Alertmanager silences / dashboard references targeting the
old names still resolve. **Delete the legacy group after one clean week.**

| Legacy alert | Replaced by |
|---|---|
| `HighErrorRate` | `AvailabilityBudgetBurnFast` + `AvailabilityBudgetBurnSlow` |
| `HighLatencyP95` | `ReadLatencyP95Breach` |
| `IngestErrorSpike` | `IngestSuccessBudgetBurnFast` |
| `APIDown` | (unchanged) |

### When `AvailabilityBudgetBurnFast` fires

1. Open the Grafana **SLOs** folder → `slo` dashboard. Confirm budget burn
   from the burn-rate plot (top-right of each row).
2. Identify which endpoint is erroring:
   ```promql
   topk(5, sum by (route) (rate(http_requests_total{status_code=~"5.."}[5m])))
   ```
3. Grab a request id from the failing response (`X-Request-Id`) or a
   `traceId` (`X-Trace-Id`) and pivot to Jaeger using the **Tracing an
   Incident** section below.
4. **Never silence the fast-burn alert.** If a deploy is in progress, you
   can silence the slow-burn variant temporarily via the Alertmanager UI.

### When `IngestSuccessBudgetBurnFast` fires

1. Check `batches_processed_total{result="dlq"}` rate in the SLO dashboard.
2. Find the failing jobId in the worker logs:
   ```
   docker compose logs ingest-worker | grep "routing to DLQ"
   ```
3. Pivot to Jaeger by `uf.jobId=<the-jobId>` (see Tracing an Incident).
4. The `grant.batch.dlq` topic preserves the failed payload — if the
   failure is recoverable (transient DB outage), replay the batch by
   reproducing it onto `grant.batch.received`.

### Where Prometheus loads the rules

| Path | Loaded by |
|---|---|
| `recording.rules.yml` + `alert.rules.yml` at repo root | docker-compose Prometheus via `prometheus.yml` `rule_files` |
| `infra/helm/uf-research-metrics/templates/prometheusrule.yaml` | kube-prometheus-stack via `PrometheusRule` CRD (production K8s) |

The K8s `PrometheusRule` inlines a copy of the same rules. **Keep both in
sync** — the helm-lint CI job renders the template but does not yet diff
it against the repo-root files. Track this as future work.

## Tracing an Incident

Distributed tracing through Jaeger covers the full API → Kafka → worker → Postgres path.
Both services (`uf-api` and `uf-ingest-worker`) share a single `traceId` per upload, so
operators can pivot from a slow / failed HTTP response into the matching trace without
guessing.

### Prerequisites

Tracing is **opt-in** to keep dev/test paths zero-overhead. Enable it by setting:

```bash
OTEL_TRACES_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318   # or http://localhost:4318 outside Docker
```

In production builds, the instrumentation bootstrap **must** be loaded via Node's
`--import` flag *before* any application module. The `pnpm start` script in both
`apps/api` and `apps/ingest-worker` already does this:

```
node --import ./dist/instrumentation.js dist/index.js
```

If you start the API/worker without `--import`, OpenTelemetry can't patch
`http`/`express`/`kafkajs`/`ioredis` and only HTTP spans will appear.

### Common incident workflows

**"User reports a slow upload" (or 5xx from the UI):**

1. In browser DevTools → Network tab → click the failing request → copy the
   `X-Trace-Id` response header (a 32-char hex string).
2. Open Jaeger UI at `http://localhost:16686` (docker-compose).
3. Search by trace ID — paste into the "Lookup by Trace ID" box at the top.
4. The trace shows: `POST /api/ingest/grants` → `kafka.produce grant.batch.received`
   (one per batch) → on the worker side, `kafka.consume grant.batch.received` → the
   `handleBatch` span (with `uf.jobId`, `uf.batchIndex`, `uf.rows` attributes) →
   Postgres + embedding spans nested underneath.

**"Worker DLQ alert fires" (IngestErrorSpike / IngestSuccessBudgetBurnFast):**

1. Grab the failing `jobId` from the alert annotation, the Alertmanager UI, or
   the worker log line (search Loki / docker-compose logs for `routing to DLQ`).
2. In Jaeger UI → Search tab → set Service = `uf-ingest-worker`, Operation =
   `handleBatch`, and add a tag filter `uf.jobId=<the-jobId>`.
3. The failing `handleBatch` span has `uf.dlq=true` and a `SpanStatusCode.ERROR`
   status with the error message — drill into its child spans to see where the
   retry loop exhausted (DB, embed, or producer).

**Correlating logs with traces:**

When OTEL is active, every pino log line includes `traceId` and `spanId` fields
(via the `mixin` on the base loggers). So:

```bash
docker compose logs api worker | grep <traceId>
```

returns every log line for that single upload across both services in chronological
order.

### When traces don't appear in Jaeger

| Symptom | Likely cause |
|---|---|
| `X-Trace-Id` header missing on responses | `OTEL_TRACES_ENABLED` is not `true`, or the app started without `--import` |
| API spans appear but no worker spans | Worker started without `--import`, OR Kafka consumer span propagation broken — check that `kafka.consume` spans exist for the topic |
| Spans appear but lack `uf.jobId` attributes | Running an old build — `handleBatch` wasn't yet wrapped in `tracer.startActiveSpan` |

## Common Commands Reference

```bash
# Development
pnpm dev                    # Start all services
pnpm --filter api dev      # Start API only
pnpm --filter web dev      # Start web only

# Database
pnpm db:migrate            # Run migrations
pnpm db:seed               # Seed database (creates admin@ufl.edu / changeme)
pnpm db:studio             # Open Prisma Studio

# Testing
pnpm test                  # Run all tests
pnpm --filter api test    # Run API tests
pnpm typecheck             # TypeScript check across monorepo

# Docker
docker compose up          # Start all services
docker compose down        # Stop all services
docker compose logs -f     # View logs
docker compose exec api <command>  # Run command in API container

# Building
pnpm build                 # Build all apps
pnpm --filter api build   # Build API
pnpm --filter web build   # Build web

# Redis
redis-cli FLUSHDB          # Flush cache (use when stale data suspected)
redis-cli KEYS "api:*"     # Inspect cached keys
```

## Getting Help

1. Check logs for error messages
2. Review this runbook for common issues
3. Review recent commits and closed PRs for related changes
4. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
5. Contact development team
