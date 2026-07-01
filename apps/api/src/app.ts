import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { trace } from '@opentelemetry/api';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { metricsMiddleware } from './middleware/prometheusMetrics.js';
import * as OpenApiValidator from 'express-openapi-validator';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import routes from './routes/index.js';

// Origins allowed to call the API cross-origin. Defaults cover local dev
// (Vite on 3000, Docker Compose web on 3030); production must set
// CORS_ALLOWED_ORIGINS explicitly (comma-separated) to the deployed web origin(s).
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:3000,http://localhost:3030')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Limits are env-overridable (defaults unchanged) so load tests / high-volume
// environments can tune them without code changes.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX ?? 100),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests', code: 'RATE_LIMITED', statusCode: 429, timestamp: new Date().toISOString() } },
});

const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.INGEST_RATE_MAX ?? 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Ingest rate limit exceeded', code: 'RATE_LIMITED', statusCode: 429, timestamp: new Date().toISOString() } },
});

// /api/ask drives paid LLM + embedding calls — throttle tighter than the global limiter.
const askLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Ask rate limit exceeded', code: 'RATE_LIMITED', statusCode: 429, timestamp: new Date().toISOString() } },
});

export function createApp(opts: { validateResponses?: boolean } = {}): express.Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // Gzip compression. Skip SSE responses (e.g. /api/ask) — buffering would defeat streaming.
  app.use(
    compression({
      filter: (req, res) => {
        if (String(res.getHeader('Content-Type')).includes('text/event-stream')) return false;
        return compression.filter(req, res);
      },
    }),
  );

  // CORS — only the configured web origin(s) may call this API, not '*'.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Rate limiting. The strict ingest limiter applies to uploads (POST) only —
  // the job-status poll (GET /api/ingest/jobs/:id) must not be throttled.
  app.use(globalLimiter);
  app.use('/api/ingest', (req, res, next) => {
    if (req.method === 'POST') {
      ingestLimiter(req, res, next);
      return;
    }
    next();
  });
  app.use('/api/reconcile', (req, res, next) => {
    if (req.method === 'POST') {
      ingestLimiter(req, res, next);
      return;
    }
    next();
  });
  app.use('/api/ask', askLimiter);

  // /api/ingest intentionally has no body parser — the ingest controller
  // consumes `req` directly as a Readable stream so CSV uploads larger than
  // the express body-limit don't get rejected before parsing begins.
  app.use(express.json());

  app.use(requestLogger);
  // X-Request-Id always; X-Trace-Id when OTEL is active so operators can pivot
  // a slow/failed response straight into Jaeger via the trace.
  app.use((req, res, next) => {
    res.setHeader('X-Request-Id', req.id as string);
    const ctx = trace.getActiveSpan()?.spanContext();
    if (ctx?.traceId) res.setHeader('X-Trace-Id', ctx.traceId);
    next();
  });
  app.use(metricsMiddleware);

  // Optional OpenAPI response-contract validation (B15) — enabled only in the
  // contract test suite / CI, never in production. Validates each response body
  // against the published spec; a mismatch throws and surfaces as a 500 whose
  // message names the offending field.
  if (opts.validateResponses || process.env.OPENAPI_VALIDATE_RESPONSES === '1') {
    const specPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../packages/shared/dist/openapi.json',
    );
    app.use(
      OpenApiValidator.middleware({
        apiSpec: specPath,
        validateRequests: false,
        validateSecurity: false,
        validateResponses: {
          onError: (errors) => {
            throw new Error('OpenAPI response contract violation: ' + JSON.stringify(errors));
          },
        },
        ignoreUndocumented: true,
      }),
    );
  }

  // Routes
  app.use(routes);

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}
