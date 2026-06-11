# ADR-0005: Cross-service tracing via OpenTelemetry auto-instrumentation

- **Status:** Accepted
- **Date:** 2026-05-24
- **Deciders:** Project lead

## Context

The async ingest pipeline crosses two services (api → ingest-worker) via a
durable event bus (Kafka). When something goes wrong — a batch lands in
DLQ, a job hangs in `processing` — the operator needs to follow the work
across all three hops (HTTP request, Kafka message, Postgres upsert) using
a single identifier.

Two implementation paths:

1. **Application-level correlation id** — generate a UUID in the API,
   stamp it into the Kafka message body, log it everywhere. Works, but
   builds an in-house tracing system that won't integrate with off-the-
   shelf tools, won't show timing waterfalls, and adds plumbing to every
   service.
2. **OpenTelemetry distributed tracing with W3C `traceparent`
   propagation** — industry-standard, integrates with Jaeger/Tempo/etc.
   out of the box, gives timing waterfalls and span attributes for free.
   The official OpenTelemetry kafkajs auto-instrumentation handles header
   inject/extract without any application code changes.

## Decision

**Use OpenTelemetry's `KafkaJsInstrumentation` for cross-service context
propagation. No manual `traceparent` header handling in application code.**

Concretely:

- `packages/telemetry/src/index.ts` constructs a `NodeSDK` with
  `HttpInstrumentation`, `ExpressInstrumentation`, `IORedisInstrumentation`,
  and `KafkaJsInstrumentation`. Both `apps/api` and `apps/ingest-worker`
  bootstrap this SDK via Node's `--import` flag before any application
  module loads (verified in the `pnpm start` script: `node --import
  ./dist/instrumentation.js dist/index.js`).
- The kafkajs instrumentation (`@opentelemetry/instrumentation-kafkajs
  @0.27.0`) injects the active span context as a W3C `traceparent`
  message header in `producer.send` and extracts it on the consumer's
  `eachMessage` callback. Source-level verified:
  `propagation.inject(...)` at instrumentation.js:428, matching
  `propagation.extract(...)` at lines 142 and 201.
- `apps/ingest-worker/src/handler.ts:handleBatch` wraps its retry loop
  in `tracer.startActiveSpan('handleBatch', { attributes: { 'uf.jobId',
  'uf.batchIndex', 'uf.rows', ... } }, ...)`. Because the kafkajs
  instrumentation already extracted the parent context from the message
  headers, this span automatically becomes a child of the consumer's
  `process <topic>` span.
- `apps/api/src/app.ts` exposes the trace id to operators via
  `X-Trace-Id` response header (read from the active span). `apps/api/src/lib/logger.ts`
  + the worker's pino instance inject `traceId`/`spanId` into every log
  line via pino's `mixin` callback.
- Opt-in via `OTEL_TRACES_ENABLED=true`. Dev/test paths are zero-overhead
  when off.

## Consequences

**Positive:**
- Operators copy `X-Trace-Id` from a failing HTTP response, paste into
  Jaeger, see the full path: `POST /api/ingest/grants` → `kafka.produce
  grant.batch.received` → `kafka.consume grant.batch.received` →
  `handleBatch` → Postgres + embedding spans.
- Logs and traces are joinable: `docker compose logs api worker | grep
  <traceId>` returns every log line for one upload across both services.
- Standard tooling. Any team familiar with OpenTelemetry can debug the
  system without reading custom correlation code.

**Negative:**
- Prisma DB-span instrumentation is disabled. `@prisma/instrumentation` is
  pinned to the Prisma client major (5.x) and targets OTel SDK 1.x; the
  2.x SDK used here removed the API it depends on. Documented inline
  (`packages/telemetry/src/index.ts:9`). Re-enable when the project
  upgrades to Prisma 6 (whose instrumentation targets the 2.x SDK).
- The instrumentation requires Node's `--import` flag in production.
  Forgetting it silently means only HTTP spans appear, not kafkajs/ioredis.
  Documented in RUNBOOK; verified in the Dockerfile's `pnpm start`
  command resolution.

**Neutral:**
- The propagation mechanism is W3C-standard `traceparent`. If the project
  ever swaps Jaeger for Tempo or DataDog, the wire format doesn't change
  — only the exporter package does. Locked-in to OTel, not to Jaeger.
