import 'dotenv/config'; // load apps/api/.env into process.env before tests resolve the DB URL
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    // Integration tests share a single Postgres database (TEST_DATABASE_URL),
    // so test files must not run concurrently — parallel writers pollute each
    // other's query results (e.g. one suite's PI names matching another's search).
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});

