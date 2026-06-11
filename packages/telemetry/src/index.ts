import { register } from 'node:module';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { KafkaJsInstrumentation } from '@opentelemetry/instrumentation-kafkajs';
// NOTE: Prisma DB-span instrumentation is intentionally omitted. @prisma/instrumentation
// is pinned to the Prisma client major (5.x) and targets the OTel 1.x SDK
// (`Tracer.getActiveSpanProcessor`), which the 2.x SDK used here removed — loading it
// crashes the process. Re-add once the project moves to Prisma 6 (whose instrumentation
// targets the 2.x SDK). HTTP/Express/Kafka/ioredis spans still give the full cross-service trace.

let sdk: NodeSDK | undefined;

/**
 * Start OpenTelemetry tracing for a service. Opt-in: a no-op unless
 * OTEL_TRACES_ENABLED=true, so the default dev/test/build paths are untouched
 * and no collector is required.
 *
 * MUST be invoked before the app's own modules load — load it via Node's
 * `--import` flag (e.g. `node --import ./dist/instrumentation.js dist/index.js`),
 * otherwise ESM hoisting means http/express/kafkajs/prisma are imported before
 * the instrumentations can patch them.
 */
export function startTracing(serviceName: string): void {
  if (process.env.OTEL_TRACES_ENABLED !== 'true') return;
  if (sdk) return;

  // ESM loader hook so the instrumentations can patch userland packages
  // (express, kafkajs, ioredis) on import. Without this only Node's core
  // `http` module is traced. Must run before the app imports those modules —
  // guaranteed because this bootstrap is loaded via `--import`.
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

  sdk = new NodeSDK({
    resource: resourceFromAttributes({ 'service.name': serviceName }),
    traceExporter: new OTLPTraceExporter({ url: `${base}/v1/traces` }),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new IORedisInstrumentation(),
      new KafkaJsInstrumentation(),
    ],
  });

  sdk.start();
  // eslint-disable-next-line no-console
  console.log(`[telemetry] tracing started for "${serviceName}" → ${base}/v1/traces`);

  const shutdown = (): void => {
    sdk
      ?.shutdown()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
