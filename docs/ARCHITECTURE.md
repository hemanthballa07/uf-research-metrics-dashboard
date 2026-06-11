# Architecture Documentation

## Overview

The UF Research Metrics Platform is a monorepo-based web application built with modern TypeScript tooling. It follows a clean architecture pattern with clear separation of concerns.

## System Architecture

```
┌─────────────────┐
│   Web Browser   │
└────────┬────────┘
         │ HTTP
         │
┌────────▼────────┐         ┌──────────────┐
│   React App     │────────▶│  Express API │
│   (Vite)        │         │  (Node.js)   │
└─────────────────┘         └──────┬───────┘
                                    │ Prisma ORM
                                    │
                           ┌────────▼────────┐
                           │   PostgreSQL    │
                           │    Database     │
                           └─────────────────┘
```

## Monorepo Structure

### Apps

#### `apps/api` - Backend API
- **Framework**: Express.js with TypeScript
- **Architecture**: Clean architecture (routes → controllers → services → db)
- **ORM**: Prisma
- **Validation**: Zod schemas from shared package
- **Error Handling**: Centralized error middleware with standardized responses

**Key Components:**
- `routes/` - Route definitions
- `controllers/` - Request/response handling
- `services/` - Business logic
- `middleware/` - Error handling, logging, async wrapper
- `db/` - Prisma client singleton

#### `apps/web` - Frontend Web App
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router
- **State Management**: React hooks (useState, useEffect)
- **API Client**: Typed fetch wrapper with error handling

**Key Components:**
- `pages/` - Route pages (Dashboard, Grants, Leaderboard)
- `components/` - Reusable UI components
- `hooks/` - Custom React hooks (useDebounce)
- `lib/` - API client and utilities

#### `apps/ingest-worker` - Event-Driven Ingest Worker
- **Role**: Standalone consumer-group service that performs grant upserts off the request path
- **Transport**: `kafkajs` consumer in group `ingest-workers`, consuming `grant.batch.received`
- **Persistence**: `upsertBatch` from `packages/db`; job progress in Redis
- **Resilience**: bounded retries + exponential backoff, dead-letter topic (`grant.batch.dlq`)
- **Scheduled jobs**: BullMQ nightly grant-expiry notifications (07:00 America/New_York)
- **Metrics**: worker-local `prom-client` registry on `:3003/metrics`

See [EVENTS.md](./EVENTS.md) for topics, envelopes, partitioning, and delivery semantics.

### Packages

#### `packages/shared` - Shared Code
- **Types**: TypeScript interfaces and types
- **Schemas**: Zod validation schemas
- **Errors**: Error classes and response shapes

#### `packages/db` - Database Layer
- **Prisma client** singleton, schema, and migrations (shared by the API and the worker)
- **`upsertBatch`**: idempotent two-phase bulk upsert (`INSERT ... ON CONFLICT ... DO UPDATE`)
- **`getExpiringGrants`**: expiry query reused by the API endpoint and the BullMQ job

#### `packages/events` - Kafka Transport
- **Topics** and **Zod message envelopes** for the ingestion pipeline
- **Client factory** (producer/consumer) and the Redis-backed **ingest job store**

#### `packages/telemetry` - OpenTelemetry Tracing
- `startTracing(serviceName)` bootstrap: NodeSDK + OTLP exporter + http/express/ioredis/kafkajs
  instrumentations. Opt-in via `OTEL_TRACES_ENABLED`; loaded via `--import` before app code.
- Produces one distributed trace across **api → Kafka → ingest-worker** (Jaeger UI on `:16686`).
  See [OBSERVABILITY.md](./OBSERVABILITY.md).

#### `packages/embeddings` - Voyage Embedding Client
- `embed(texts)` → Voyage `voyage-3` (1024-dim) vectors; provider-swappable; `VOYAGE_API_KEY`-gated.

#### Semantic Search + RAG (pgvector)
- Grants are embedded into a `grant_embeddings` `vector(1024)` table (HNSW cosine index, pgvector).
- `GET /api/grants/:id/similar` (cosine-nearest) and `POST /api/ask` (retrieve-then-stream Claude over
  SSE with grant citations). Embeddings backfilled by `pnpm embed:grants` + best-effort embed-on-ingest
  in the worker. See [RAG.md](./RAG.md).

### Deployment — AWS / EKS / Helm (`infra/`)
- **Terraform** (`infra/terraform/`) provisions VPC, EKS, RDS Postgres (pgvector), ECR, IRSA, and a
  Secrets Manager secret (state in S3 + DynamoDB lock).
- **Helm** (`infra/helm/uf-research-metrics/`) deploys api/web/worker + a pre-upgrade migration Job +
  ALB Ingress + ExternalSecret; redis/redpanda/kube-prometheus-stack/jaeger are separate releases.
- **GitHub OIDC** deploy: `terraform plan` on PRs, `apply` + image build/push + helm on manual dispatch
  (prod environment approval). Teardown-first (`make demo-up`/`demo-down`). See [../infra/README.md](../infra/README.md).

## Database Architecture

### Schema Design

The database uses PostgreSQL with Prisma ORM. Key tables:

- **departments** - University departments
- **faculty** - Faculty members (linked to departments)
- **sponsors** - Grant sponsors (federal, state, foundation, etc.)
- **grants** - Grant records (linked to sponsors, faculty, departments)

### Relationships

```
Department 1───N Faculty
Department 1───N Grant
Faculty     1───N Grant (as PI)
Sponsor     1───N Grant
```

### Indexes

Indexes are strategically placed on:
- Foreign keys (departmentId, sponsorId, piId)
- Frequently queried fields (status, submittedAt, awardedAt)
- Unique constraints (email, department name)

## API Design

### RESTful Endpoints

- `GET /api/health` - Health check
- `GET /api/metrics/summary` - Aggregated metrics
- `GET /api/grants` - List grants with filtering and pagination
- `GET /api/faculty/leaderboard` - Ranked faculty by awarded amount
- `POST /api/ingest/grants` - Async CSV ingestion; returns `202 { jobId, batches }` (see [EVENTS.md](./EVENTS.md))
- `GET /api/ingest/jobs/:id` - Ingest job status for client polling

### Error Handling

All errors follow a standardized format:
```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "statusCode": 400,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### SQL Proficiency Demonstrations

The API demonstrates advanced SQL usage:

1. **Window Functions**: `RANK() OVER` in faculty leaderboard query
2. **Aggregations**: `SUM()`, `COUNT()` with `GROUP BY`
3. **Date Functions**: `EXTRACT(EPOCH FROM ...)` for time calculations
4. **CTEs**: Common Table Expressions for complex queries
5. **Parameterized Queries**: All raw SQL uses Prisma `$queryRaw` with parameters

## Frontend Architecture

### Component Structure

- **Pages**: Top-level route components
- **Components**: Reusable UI components (Layout, LoadingSpinner, ErrorDisplay, GrantDrawer)
- **Hooks**: Custom React hooks for shared logic
- **Lib**: API client and utility functions

### State Management

- Local component state with `useState`
- API data fetching with `useEffect`
- Debounced search with custom `useDebounce` hook

### Error Handling

- Loading states for async operations
- Error display components with retry functionality
- Typed API client with error classes

## Development Workflow

### Local Development

1. **Non-Docker**: Run services directly with pnpm
2. **Docker**: Use docker-compose for isolated environment

### Testing Strategy

- **Unit Tests**: Vitest for service logic and validation
- **Integration Tests**: Supertest for API endpoints
- **Test Database**: PostgreSQL service in CI, configurable locally

### CI/CD

GitHub Actions workflow:
1. Lint code
2. Type check
3. Run tests (with PostgreSQL service)
4. Build applications

## Security Considerations

- Parameterized SQL queries (no SQL injection)
- Input validation with Zod schemas
- Error messages don't expose sensitive information
- Environment variables for secrets

## Performance Optimizations

- Database indexes on frequently queried fields
- Pagination for large datasets
- Debounced search inputs
- Efficient SQL queries with proper JOINs

## Future Enhancements

- Authentication and authorization
- Caching layer (Redis)
- Real-time updates (WebSockets)
- Advanced analytics and reporting
- Export functionality (PDF, Excel)

