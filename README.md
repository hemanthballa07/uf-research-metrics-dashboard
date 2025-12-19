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

## Design Decisions

### Prisma ORM + Raw SQL
- **Prisma** handles schema migrations, type safety, and common CRUD operations
- **Raw SQL** (`$queryRaw`) used for complex analytics requiring window functions (`RANK() OVER`, `PERCENTILE_CONT`)
- This hybrid approach balances developer experience with SQL performance and correctness

### Text/Plain CSV Ingestion
- Accepts CSV as `text/plain` (not `multipart/form-data`) for simplicity and reliability
- Handles complex CSV structures (quoted fields, embedded commas) with custom parser
- Zod validation ensures data correctness before database operations
- Detailed error reporting includes row numbers and field-level validation errors

### Correctness Prioritization
- Foreign key constraints prevent orphaned records (`onDelete: Restrict`)
- Uniqueness constraints enforce data integrity (department names, faculty emails)
- Application-level validation complements database constraints
- SQL queries use proper NULL handling (`COALESCE`) and division-by-zero protection
- Date range validation prevents invalid temporal data

## Demo

<!-- Demo GIF placeholder - Add demo.gif to assets/ folder when available -->
<!-- ![Platform Demo](./assets/demo.gif) -->

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) - System architecture and design decisions
- [Schema](./docs/SCHEMA.md) - Database schema documentation
- [Runbook](./docs/RUNBOOK.md) - Operations guide and troubleshooting
- [Talking Points](./docs/TALKING_POINTS.md) - Elevator pitch and technical overview

## License

Internal use only - University of Florida Office of Research
