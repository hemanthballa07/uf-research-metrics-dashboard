FROM node:22-alpine AS base

# OpenSSL 1.1 is required by the Prisma query engine on Alpine
RUN apk add --no-cache openssl

RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# Copy package files (workspace install needs every package manifest)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/ingest-worker/package.json ./apps/ingest-worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/events/package.json ./packages/events/
COPY packages/telemetry/package.json ./packages/telemetry/
COPY packages/embeddings/package.json ./packages/embeddings/
COPY packages/sdk/package.json ./packages/sdk/

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
WORKDIR /app

# Build workspace dependencies to dist/ — apps/ingest-worker imports them via
# the package.json "import" export condition (./dist/index.js), and
# .dockerignore excludes any pre-built dist/ from the build context.
RUN pnpm --recursive --filter './packages/*' build

WORKDIR /app/apps/ingest-worker
RUN pnpm build
CMD ["pnpm", "start"]
