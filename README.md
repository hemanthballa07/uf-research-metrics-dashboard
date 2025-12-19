# UF Research Metrics Platform

Internal web platform for a university Office of Research to track grant activity, faculty productivity, and research metrics.

**Quick Start:** See [Getting Started](#getting-started) below. For Docker: `docker compose up` then run migrations. For local: ensure PostgreSQL is running, copy `.env.example` to `.env`, run `pnpm db:migrate` and `pnpm db:seed`, then `pnpm dev`.

## Architecture

Monorepo structure:
- `apps/api` - Express + TypeScript backend
- `apps/web` - React + TypeScript + Vite frontend
- `packages/shared` - Shared types, Zod schemas, and error contracts

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0 (install via `npm install -g pnpm` or `corepack enable`)
- PostgreSQL >= 16 (for local development, or use Docker)
- Docker and Docker Compose (for Docker development)

### Installation

```bash
pnpm install
```

### Local Development (Non-Docker)

**Prerequisites:**
- Ensure PostgreSQL is running and accessible
- Create the database: `createdb uf_research_metrics` (or use your preferred method)

1. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your PostgreSQL connection string
   # Update DATABASE_URL to match your local PostgreSQL instance
   # See .env.example for detailed comments on each variable
   ```

2. **Set up the database:**
   ```bash
   # Run migrations (this also generates Prisma Client)
   pnpm db:migrate

   # Seed database with sample data
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
   # Check API health
   curl http://localhost:3001/api/health
   # Should return: {"status":"ok","service":"api",...}
   ```

### Docker Development

1. **Start all services:**
   ```bash
   docker compose up
   ```
   This will:
   - Start PostgreSQL (database is auto-created)
   - Build and start the API service
   - Build and start the Web service
   - Wait for PostgreSQL to be healthy before starting API

2. **Run migrations and seed:**
   ```bash
   # Wait for services to be ready, then run:
   docker compose exec api pnpm --filter api db:migrate
   docker compose exec api pnpm --filter api db:seed
   ```

3. **Access services:**
   - Web: http://localhost:3000
   - API: http://localhost:3001
   - Database: localhost:5432

4. **Verify setup:**
   ```bash
   # Check API health
   curl http://localhost:3001/api/health
   # Should return: {"status":"ok","service":"api",...}
   ```

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

## API Endpoints

### Health Check
```bash
GET /api/health
```

### Metrics Summary
```bash
GET /api/metrics/summary
# Returns: totalSubmissions, totalAwardedAmount, awardRate, medianTimeToAward
```

### Grants
```bash
GET /api/grants?page=1&pageSize=20&status=awarded&search=Machine
# Query params: department, sponsor, status, date_from, date_to, search, page, pageSize
```

### Faculty Leaderboard
```bash
GET /api/faculty/leaderboard?department=1
# Query params: department (optional)
```

### CSV Ingestion
```bash
POST /api/ingest/grants
Content-Type: text/plain
# Body: CSV file content
# Returns: { totalRows, inserted, updated, errors: [] }
```

### Example cURL Commands

```bash
# Health check
curl http://localhost:3001/api/health

# Metrics summary
curl http://localhost:3001/api/metrics/summary

# Get grants with filters
curl "http://localhost:3001/api/grants?status=awarded&page=1&pageSize=10"

# Faculty leaderboard
curl http://localhost:3001/api/faculty/leaderboard

# Ingest CSV
curl -X POST http://localhost:3001/api/ingest/grants \
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

## Project Structure

```
uf-research-metrics-platform/
├── apps/
│   ├── api/              # Express backend
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   └── db/
│   │   └── prisma/
│   └── web/              # React frontend
│       └── src/
│           ├── components/
│           ├── pages/
│           ├── hooks/
│           └── lib/
├── packages/
│   └── shared/           # Shared types and schemas
├── data/                 # Sample data files
└── docs/                 # Documentation
```

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) - System architecture and design decisions
- [Schema](./docs/SCHEMA.md) - Database schema documentation
- [Runbook](./docs/RUNBOOK.md) - Operations guide and troubleshooting

## License

Internal use only - University of Florida Office of Research
