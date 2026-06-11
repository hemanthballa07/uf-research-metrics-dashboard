import pino from 'pino';
import { trace } from '@opentelemetry/api';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // Inject traceId/spanId into every log line when OTEL is active, so logs
  // pivot cleanly to the Jaeger trace via `X-Trace-Id` (set in app.ts).
  mixin() {
    const ctx = trace.getActiveSpan()?.spanContext();
    return ctx?.traceId ? { traceId: ctx.traceId, spanId: ctx.spanId } : {};
  },
  ...(process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
});

export default logger;
