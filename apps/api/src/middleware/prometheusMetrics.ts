import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const ingestRowsTotal = new Counter({
  name: 'ingest_rows_processed_total',
  help: 'Total rows processed by the CSV ingestion pipeline',
  labelNames: ['result'],
  registers: [registry],
});

export const cacheHitsTotal = new Counter({
  name: 'cache_hits_total',
  help: 'Total Redis cache hits',
  labelNames: ['route'],
  registers: [registry],
});

export const cacheMissesTotal = new Counter({
  name: 'cache_misses_total',
  help: 'Total Redis cache misses',
  labelNames: ['route'],
  registers: [registry],
});

export const dailyActiveUsers = new Gauge({
  name: 'uf_daily_active_users',
  help: 'Distinct authenticated users active in the last 24h (from audit_logs)',
  registers: [registry],
});

/**
 * Polls audit_logs for the distinct-user count over the last 24h and updates
 * the uf_daily_active_users gauge. Makes the "40–60 daily users" claim verifiable
 * from /metrics. Returns the interval handle so callers can clear it on shutdown.
 */
export function startDauCollector(prisma: PrismaClient, intervalMs = 60_000): NodeJS.Timeout {
  const refresh = async (): Promise<void> => {
    try {
      const rows = await prisma.$queryRawUnsafe<{ dau: number }[]>(
        `SELECT COUNT(DISTINCT "actorId")::int AS dau
         FROM audit_logs
         WHERE "createdAt" >= NOW() - INTERVAL '1 day'`,
      );
      dailyActiveUsers.set(rows[0]?.dau ?? 0);
    } catch {
      // best-effort metric — never crash the process on a transient DB error
    }
  };
  void refresh();
  const handle = setInterval(() => void refresh(), intervalMs);
  handle.unref(); // don't keep the event loop alive for this timer alone
  return handle;
}

function normalizeRoute(req: Request): string {
  // Use the *mounted* route pattern so labels carry the full prefix:
  // `app.use('/api/ingest', ingestRoutes)` + `router.post('/grants', ...)` yields
  // `/api/ingest/grants`, not just `/grants`. This lets the SLO recording rules
  // distinguish read endpoints from ingest endpoints via `route!~"/api/ingest/.*"`.
  // Falls back to req.path (already the full URL path) to avoid cardinality explosion
  // when no route matched.
  const matched = req.route?.path;
  if (matched) return (req.baseUrl ?? '') + matched;
  return req.path ?? 'unknown';
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = normalizeRoute(req);
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);
  });

  next();
}
