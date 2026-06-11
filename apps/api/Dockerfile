FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/

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
WORKDIR /app/apps/api

# Build the application
RUN pnpm build

# Start the API. Migrations run separately:
#  - local docker-compose: a one-off `prisma migrate deploy` (see compose / docs)
#  - Kubernetes: the Helm pre-install/pre-upgrade migrate Job (so api replicas don't race)
# The `start` script is `node --import ./dist/instrumentation.js dist/index.js`.
EXPOSE 3001
CMD ["pnpm", "start"]

