FROM node:22-alpine AS base

# OpenSSL 1.1 is required by the Prisma query engine on Alpine
RUN apk add --no-cache openssl

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/events/package.json ./packages/events/
COPY packages/telemetry/package.json ./packages/telemetry/
COPY packages/embeddings/package.json ./packages/embeddings/
COPY packages/sdk/package.json ./packages/sdk/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma Client (schema now lives in packages/db)
WORKDIR /app/packages/db
RUN pnpm exec prisma generate

# Development stage
FROM base AS development
WORKDIR /app
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "dev"]

# Production stage
FROM base AS production
WORKDIR /app

# Build workspace dependencies to dist/ — apps/api imports them via the
# package.json "import" export condition (./dist/index.js), and .dockerignore
# excludes any pre-built dist/ from the build context.
RUN pnpm --recursive --filter './packages/*' build

WORKDIR /app/apps/api

# Build the application
RUN pnpm build

# Start the API. Migrations run separately:
#  - local docker-compose: a one-off `prisma migrate deploy` (see compose / docs)
#  - Kubernetes: the Helm pre-install/pre-upgrade migrate Job (so api replicas don't race)
# The `start` script is `node --import ./dist/instrumentation.js dist/index.js`.
EXPOSE 3001
CMD ["pnpm", "start"]

