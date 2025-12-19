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
- PostgreSQL (for local development)

### Installation

```bash
pnpm install
```

### Development

```bash
# Start all services in development mode
pnpm dev

# Or start individually:
pnpm --filter api dev
pnpm --filter web dev
```

### Building

```bash
pnpm build
```

### Database

```bash
# Run migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Open Prisma Studio
pnpm db:studio
```

## Project Status

🚧 Under active development - Slice 1 complete (monorepo scaffold)

