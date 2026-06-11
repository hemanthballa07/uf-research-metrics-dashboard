import 'dotenv/config'; // load apps/ingest-worker/.env (DATABASE_URL, KAFKA_BROKERS, REDIS_URL)
import { defineConfig } from 'vitest/config';

// SEPARATE, opt-in target — NOT part of the default `vitest run`. It requires a
// live redpanda/Kafka broker + Postgres + Redis, so it is wired only into a
// dedicated CI job (see .github/workflows/ci.yml). Run locally with:
//   docker compose up -d redpanda postgres redis
//   pnpm --filter @uf-research-metrics-platform/ingest-worker test:integration
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.integration.test.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
