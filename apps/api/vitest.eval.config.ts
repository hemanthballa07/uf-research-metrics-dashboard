import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Opt-in RAG eval target (NOT part of the default `vitest run`, which only includes *.test.ts).
// Runs the *.eval.ts golden Q&A pairs; key-gated (skips without ANTHROPIC/VOYAGE keys).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/eval/**/*.eval.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
