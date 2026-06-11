FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy package files (workspace install needs every package manifest)
COPY package.json pnpm-workspace.yaml ./
COPY apps/ingest-worker/package.json ./apps/ingest-worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/events/package.json ./packages/events/

RUN pnpm install --frozen-lockfile

COPY . .

# Generate Prisma Client (schema lives in packages/db)
WORKDIR /app/packages/db
RUN pnpm exec prisma generate

# Development stage
FROM base AS development
WORKDIR /app
CMD ["pnpm", "--filter", "@uf-research-metrics-platform/ingest-worker", "dev"]

# Production stage
FROM base AS production
WORKDIR /app/apps/ingest-worker
RUN pnpm build
CMD ["pnpm", "start"]
