# Observability

Two complementary signals:

- **Metrics** (Prometheus) — aggregate rates/latencies/counters scraped from the api (`:3001/metrics`)
  and ingest-worker (`:3003/metrics`); visualized in Grafana, alerted via Alertmanager.
- **Traces** (OpenTelemetry) — per-request causal traces spanning **api → Kafka → ingest-worker**,
  exported via OTLP to Jaeger. This doc covers tracing; see `docs/ARCHITECTURE.md` for metrics.

## What gets traced

A single CSV ingest produces one connected trace:

```
POST /api/ingest/grants            (uf-api, http + express spans)
  └─ request handler /api/ingest/grants
       └─ send grant.batch.received (uf-api, kafkajs producer)
            └─ process grant.batch.received (uf-ingest-worker, kafkajs consumer)
                 ├─ redis get/keys/set (cache bust + job store)
                 └─ send grant.ingested (uf-ingest-worker, kafkajs producer)
```

Instrumented: **http, express, ioredis, kafkajs** (the kafkajs instrumentation injects a W3C
`traceparent` into message headers on produce and extracts it on consume — that is what links the
worker's consume span to the api's produce span across the process boundary).

> **Prisma DB spans are not included.** `@prisma/instrumentation` is pinned to the Prisma client
> major (5.x) and targets the OpenTelemetry 1.x SDK API (`Tracer.getActiveSpanProcessor`), which the
> 2.x SDK used here removed — loading it crashes the process. Re-enable once the project upgrades to
> Prisma 6 (whose instrumentation targets the 2.x SDK): add `@prisma/instrumentation`, register
> `PrismaInstrumentation`, and set `previewFeatures = ["tracing"]` on the Prisma generator.

## How it's wired

- `packages/telemetry` exposes `startTracing(serviceName)` — configures a `NodeSDK` with an OTLP
  proto exporter and the instrumentations above. **Opt-in:** a no-op unless `OTEL_TRACES_ENABLED=true`,
  so default `dev`, tests, and builds are unaffected and need no collector.
- Each app has a tiny `src/instrumentation.ts` that calls `startTracing('uf-api' | 'uf-ingest-worker')`.
- **ESM requirement:** the bootstrap is loaded with Node's `--import` flag so it runs *before* app
  modules — ESM hoists `import`s, so importing the SDK from inside `index.ts` would be too late to
  patch http/express/kafkajs/ioredis. `startTracing` also calls
  `module.register('@opentelemetry/instrumentation/hook.mjs', …)` to activate the
  import-in-the-middle loader hook; without it only Node's core `http` module is traced and userland
  packages (express, kafkajs, ioredis) are not.
  - prod: `start` → `node --import ./dist/instrumentation.js dist/index.js`
  - dev: `dev:traced` → `tsx watch --import ./src/instrumentation.ts src/index.ts` (default `dev` is untraced)

## Env vars

| Var | Purpose | Example |
|---|---|---|
| `OTEL_TRACES_ENABLED` | Master switch; tracing is a no-op unless `true` | `true` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector base URL (`/v1/traces` is appended) | `http://localhost:4318` (host) / `http://jaeger:4318` (compose) |

## Run it locally

```bash
docker compose up -d postgres redis redpanda jaeger
# host-based, traced:
OTEL_TRACES_ENABLED=true OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
  pnpm --filter @uf-research-metrics-platform/api start &
OTEL_TRACES_ENABLED=true OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
  pnpm --filter @uf-research-metrics-platform/ingest-worker start &
# POST a CSV to /api/ingest/grants, then open Jaeger:
open http://localhost:16686   # service "uf-api" → find the POST /api/ingest/grants trace
```

In `docker compose up` the api + ingest-worker services already set `OTEL_TRACES_ENABLED=true` and
point at the bundled `jaeger` service, and run via `dev:traced`.
