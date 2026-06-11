# UF Research Metrics Platform

**Purpose:** Internal analytics platform for University Office of Research to track grant activity, faculty productivity, and institutional research metrics.

**Problem Solved:** Provides real-time visibility into grant submissions, award rates, faculty performance rankings, and research metrics. Enables data-driven decision making for research administration.

**Quick Start:** See [Getting Started](#getting-started) below. For Docker: `docker compose up` then run migrations. For local: ensure PostgreSQL is running, copy `.env.example` to `.env`, run `pnpm db:migrate` and `pnpm db:seed`, then `pnpm dev`.

## Relevance to University Office of Research

This platform directly addresses core operational needs of a University Office of Research:

**Research Metrics Tracking:** Provides institutional-level visibility into grant submission volumes, award rates, and funding trends over time. Enables administrators to identify patterns, benchmark performance, and allocate resources effectively.

**Grant Data Management:** Centralizes grant information across departments, sponsors, and faculty members. Supports filtering, searching, and exporting capabilities for reporting and analysis. CSV ingestion allows bulk data updates from existing systems.

**Administrative Decision-Making:** Faculty leaderboard rankings help identify high-performing researchers and departments. Median time-to-award metrics inform process improvements. Status breakdowns highlight bottlenecks in the grant lifecycle.

**Long-Term Maintainability:** Built with TypeScript for type safety, Prisma for schema management, and comprehensive documentation. Docker Compose enables consistent deployment across environments. Clean architecture patterns ensure the codebase remains maintainable as requirements evolve.

## Architecture

Monorepo structure:
- `apps/api` - Express + TypeScript backend
- `apps/web` - React + TypeScript + Vite frontend
- `packages/shared` - Shared types, Zod schemas, and error contracts

Supporting infrastructure (via Docker Compose):
- **PostgreSQL** — primary data store
- **Redis** — response cache (5-min TTL, invalidated on ingest)
- **Redpanda** — Kafka-compatible event bus for async grant-batch ingestion
- **Prometheus** — scrapes `/api/metrics` for telemetry; loads SLI recording rules + burn-rate alerts
- **Grafana** — pre-provisioned dashboards: per-endpoint observability + SLO budget tracking
- **Alertmanager** — alert routing for SLO burn-rate alerts
- **Jaeger** — distributed traces across API → Kafka → ingest-worker → Postgres (opt-in via `OTEL_TRACES_ENABLED=true`)

### Production Readiness

The platform has been hardened for production-grade operation. None of the K8s
resources are applied automatically — the chart is shipped as a deployable
artifact, not a running deployment.

- **Streaming CSV ingest** — `POST /api/ingest/grants` parses + produces one
  batch at a time; peak RSS is O(batch_size) regardless of file size.
  See [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md) for measured numbers.
- **SLOs + burn-rate alerts** — 99.9% availability, ≤1.0s read p95, 99.5%
  ingest success. Multi-window burn-rate alerts (Google SRE convention) with
  min-traffic guards to avoid off-hours flapping. Targets derived from k6 +
  e2e benchmarks; see [`docs/RUNBOOK.md#slos-and-error-budget`](docs/RUNBOOK.md#slos-and-error-budget).
- **Distributed tracing** — OpenTelemetry auto-instrumentation propagates
  `traceparent` via Kafka message headers, giving operators a single trace
  from `POST /api/ingest/grants` through to the worker's per-batch upsert.
  `X-Trace-Id` is exposed on every response for pivot-to-Jaeger workflows.
  See [`docs/RUNBOOK.md#tracing-an-incident`](docs/RUNBOOK.md#tracing-an-incident).
- **K8s chart** (`infra/helm/uf-research-metrics/`) — HPA (api 2→6, worker
  1→3), PodDisruptionBudgets, NetworkPolicy, idempotent topic bootstrap,
  PrometheusRule CR for kube-prometheus-stack, ExternalSecrets for AWS
  Secrets Manager. Helm-lint CI job renders both `values.yaml` and
  `values-prod.yaml`, asserting that gated resources only emit when their
  flags are on.
- **Audit logging** — every privileged action writes to `audit_logs`;
  daily-active-user gauge surfaces in Prometheus.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0 (install via `npm install -g pnpm` or `corepack enable`)
- PostgreSQL >= 16 (for local development, or use Docker)
- Redis >= 7 (for local development, or use Docker)
- Docker and Docker Compose (for Docker development)

### Installation

```bash
pnpm install
```

### Local Development (Non-Docker)

**Prerequisites:**
- Ensure PostgreSQL and Redis are running and accessible
- Create the database: `createdb uf_research_metrics` (or use your preferred method)

1. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your PostgreSQL connection string and Redis URL
   # See .env.example for detailed comments on each variable
   ```

2. **Set up the database:**
   ```bash
   # Run migrations (this also generates Prisma Client)
   pnpm db:migrate

   # Seed database with sample data (creates admin@ufl.edu / changeme)
   pnpm db:seed
   ```

3. **Start development servers:**
   ```bash
   # Start all services
   pnpm dev

   # Or start individually:
   pnpm --filter api dev    # API on http://localhost:3001
   pnpm --filter web dev    # Web on http://localhost:3000
   ```

4. **Verify setup:**
   ```bash
   # Check API health (no auth required)
   curl http://localhost:3001/api/health
   # Should return: {"status":"ok","service":"api",...}
   ```

5. **Sign in:** Open http://localhost:3000 and sign in with `admin@ufl.edu` / `changeme`.

### Docker Development

1. **Start all services:**
   ```bash
   docker compose up
   ```
   This starts PostgreSQL, Redis, API, Web, Prometheus, Grafana, and Alertmanager.

2. **Run migrations and seed:**
   ```bash
   docker compose exec api pnpm --filter api db:migrate
   docker compose exec api pnpm --filter api db:seed
   ```

3. **Access services:**
   - Web: http://localhost:3000
   - API: http://localhost:3001
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3002 (admin / admin)
   - Database: localhost:5432
   - Redis: localhost:6379

4. **Verify setup:**
   ```bash
   curl http://localhost:3001/api/health
   ```

5. **Sign in:** Open http://localhost:3000. Default admin: `admin@ufl.edu` / `changeme`.

### Building

```bash
pnpm build
```

### Database Management

```bash
# Run migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Open Prisma Studio (database GUI)
pnpm db:studio
```

## Authentication

All `/api/*` routes except `/api/health` and `/api/auth/login` require a JWT Bearer token.

```bash
# Obtain token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ufl.edu","password":"changeme"}'
# Returns: {"token":"<jwt>","user":{...}}

# Use token
curl http://localhost:3001/api/metrics/summary \
  -H "Authorization: Bearer <jwt>"
```

Tokens expire after 8 hours. Two roles: `ADMIN` (full access) and `VIEWER` (read-only).

The React frontend handles auth automatically: a login page captures credentials, stores the JWT in localStorage, and attaches it as a Bearer header on every request.

## API Endpoints

### Auth
```
POST /api/auth/login          { email, password } → { token, user }
GET  /api/auth/me             → { user }   (requires token)
```

### Health (no auth)
```
GET /api/health
```

### Metrics
```
GET /api/metrics/summary
GET /api/metrics/timeseries?months=12
GET /api/metrics/status-breakdown
GET /api/metrics/awards-by-sponsor-type?months=12
```

### Insights
```
GET /api/insights?months=12&departmentId=1&sponsorType=federal&status=awarded
```

### Grants
```
GET  /api/grants?page=1&pageSize=20&status=awarded&search=Machine
GET  /api/grants/:id
GET  /api/grants/export?format=csv|json&status=awarded
POST /api/ingest/grants       Content-Type: text/plain  (CSV body)
```

### Faculty & Reference Data
```
GET /api/faculty/leaderboard?department=1
GET /api/departments
GET /api/sponsors
```

### Observability
```
GET /api/metrics              (Prometheus scrape endpoint — no auth)
```

### Example cURL Commands

```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ufl.edu","password":"changeme"}' | jq -r .token)

# Metrics summary
curl http://localhost:3001/api/metrics/summary \
  -H "Authorization: Bearer $TOKEN"

# Get grants with filters
curl "http://localhost:3001/api/grants?status=awarded&page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN"

# Export grants as CSV
curl "http://localhost:3001/api/grants/export?format=csv" \
  -H "Authorization: Bearer $TOKEN" -o grants.csv

# Faculty leaderboard
curl http://localhost:3001/api/faculty/leaderboard \
  -H "Authorization: Bearer $TOKEN"

# Ingest CSV (ADMIN role required)
curl -X POST http://localhost:3001/api/ingest/grants \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: text/plain" \
  --data-binary @data/sample_grants.csv
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm --filter api test --watch

# Run with coverage
pnpm --filter api test --coverage
```

Integration tests require a running PostgreSQL instance. Set `TEST_DATABASE_URL` or `DATABASE_URL` in `.env`. The test setup automatically creates a test admin user and obtains a JWT token for protected route tests.

## Rate Limiting

- Global: 100 requests/min per IP
- Ingest: 10 requests/min per IP

## Project Structure

```
uf-research-metrics-platform/
├── apps/
│   ├── api/              # Express backend
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── routes/
│   │   │   ├── middleware/   # auth, cache, rate limit, prometheus
│   │   │   ├── lib/          # Redis cache client
│   │   │   └── db/
│   │   └── prisma/
│   └── web/              # React frontend
│       └── src/
│           ├── components/
│           ├── contexts/     # AuthContext
│           ├── pages/        # LoginPage + protected pages
│           ├── hooks/
│           └── lib/          # apiClient, auth token helpers
├── packages/
│   └── shared/           # Shared types and schemas
├── grafana/              # Pre-provisioned Grafana dashboards
├── data/                 # Sample data files
├── prometheus.yml        # Prometheus scrape config
├── alert.rules.yml       # Alertmanager rules
└── docs/                 # Documentation
```

## Design Decisions

### JWT Authentication
All API routes (except health and login) require a Bearer token. The web app stores tokens in localStorage and attaches them automatically. Tokens expire after 8 hours. Two roles: `ADMIN` (write access) and `VIEWER` (read-only).

### Redis Cache (best-effort)
Metrics and insights responses are cached for 5 minutes. Cache is invalidated on ingest via SCAN+DEL pattern. If Redis is unavailable, requests fall through to the database — Redis is not a hard dependency.

### Prometheus Telemetry
`prom-client` instruments every request with histograms (latency by route), counters (status codes, ingest results), and cache hit/miss counts. Scraped by Prometheus; visualized in Grafana.

### Prisma ORM + Raw SQL
Prisma handles schema migrations, type safety, and common CRUD. Raw SQL (`$queryRaw`) is used for analytics requiring window functions (`RANK() OVER`, `PERCENTILE_CONT`).

### Text/Plain CSV Ingestion
Accepts CSV as `text/plain` (not `multipart/form-data`). Parsed with custom parser; validated with Zod before any DB writes. Idempotent via `@@unique([title, piId])` + Prisma upsert. Concurrency capped at 5 with `p-limit`.

### Correctness Prioritization
Foreign key constraints prevent orphaned records (`onDelete: Restrict`). Uniqueness constraints enforce data integrity. SQL queries use proper NULL handling and division-by-zero protection.

## Demo

![Platform Demo](./docs/assets/demo.gif)

*Interactive dashboard showing grant metrics, filtering capabilities, and faculty leaderboard rankings.*

**What reviewers should try:**
- **Login page**: Sign in with admin@ufl.edu / changeme
- **Dashboard**: View KPI cards, status breakdown visualization, and Visual Insights charts
- **Grants page**: Filter by status and department, then click a grant row to see the detail drawer. Export as CSV/JSON.
- **Leaderboard**: Switch department filter to see ranked faculty by awarded amount
- **Insights page**: Interactive analytics console with advanced visualizations, filters, and drill-down capabilities

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) - System architecture and design decisions
- [Schema](./docs/SCHEMA.md) - Database schema documentation
- [Runbook](./docs/RUNBOOK.md) - Operations guide and troubleshooting

## License

Internal use only - University of Florida Office of Research
