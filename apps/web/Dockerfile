FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Development stage
FROM base AS development
WORKDIR /app
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "dev", "--host"]

# Production stage
FROM base AS production
WORKDIR /app

# API base URL baked into the SPA at build time. Empty ("") → same-origin relative /api,
# served by the same ALB that fronts the web (see infra Ingress). Pass via
# `docker build --build-arg VITE_API_URL=""`.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Build the SDK first — web imports types from it
RUN pnpm --filter @uf-research-metrics-platform/sdk build

# Build the application
WORKDIR /app/apps/web
RUN pnpm build

# Use nginx to serve static files
FROM nginx:alpine AS web-production
COPY --from=production /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

