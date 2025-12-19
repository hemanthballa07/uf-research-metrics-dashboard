# UF Research Metrics Platform

Internal web platform for a university Office of Research to track grant activity, faculty productivity, and research metrics.

## Architecture

Monorepo structure:
- `apps/api` - Express + TypeScript backend
- `apps/web` - React + TypeScript + Vite frontend
- `packages/shared` - Shared types, Zod schemas, and error contracts

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL >= 16 (for local development)

### Installation

```bash
pnpm install
```

### Local Development (Non-Docker)

1. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your PostgreSQL connection string
   ```

2. **Set up the database:**
   ```bash
   # Generate Prisma Client
   pnpm --filter api exec prisma generate

   # Run migrations
   pnpm db:migrate

   # Seed database
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

### Docker Development

1. **Start all services:**
   ```bash
   docker compose up
   ```

2. **Run migrations and seed:**
   ```bash
   docker compose exec api pnpm --filter api db:migrate
   docker compose exec api pnpm --filter api db:seed
   ```

3. **Access services:**
   - Web: http://localhost:3000
   - API: http://localhost:3001
   - Database: localhost:5432

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
