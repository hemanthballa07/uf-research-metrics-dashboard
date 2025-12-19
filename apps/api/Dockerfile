FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma Client
WORKDIR /app/apps/api
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

# Run migrations and start
EXPOSE 3001
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm start"]

