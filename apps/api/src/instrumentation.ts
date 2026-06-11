// Loaded via `node --import ./dist/instrumentation.js` (prod) or
// `tsx --import ./src/instrumentation.ts` (dev:traced) BEFORE the app modules,
// so OpenTelemetry can patch http/express/ioredis/kafkajs/prisma. No-op unless
// OTEL_TRACES_ENABLED=true.
import { startTracing } from '@uf-research-metrics-platform/telemetry';

startTracing('uf-api');
