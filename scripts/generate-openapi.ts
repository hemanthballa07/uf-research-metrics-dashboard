/**
 * Generates openapi.json from shared Zod schemas.
 * Run: npx tsx scripts/generate-openapi.ts
 * Output: packages/shared/dist/openapi.json
 *
 * `buildDocument()` is exported so the contract-test freshness check can build
 * the spec in-process without writing the file.
 */

import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

extendZodWithOpenApi(z);

import {
  grantStatusSchema,
  sponsorTypeSchema,
  grantSchema,
  errorEnvelopeSchema,
  facultySchema,
  departmentSchema,
  sponsorSchema,
  grantsQuerySchema,
  facultyLeaderboardQuerySchema,
  timeseriesQuerySchema,
  awardsBySponsorTypeQuerySchema,
  insightsQuerySchema,
} from '../packages/shared/src/schemas.js';

const registry = new OpenAPIRegistry();

// Register security scheme
const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// Register schemas
registry.register(
  'GrantStatus',
  grantStatusSchema.openapi({ description: 'Grant lifecycle status' })
);
registry.register(
  'SponsorType',
  sponsorTypeSchema.openapi({ description: 'Type of funding sponsor' })
);
registry.register('Grant', grantSchema.openapi({ description: 'A research grant record' }));
registry.register('Faculty', facultySchema.openapi({ description: 'A faculty member (PI)' }));
registry.register('Department', departmentSchema.openapi({ description: 'University department' }));
registry.register('Sponsor', sponsorSchema.openapi({ description: 'Grant sponsor organization' }));

// Response-shaped grant variants: a serialized API response renders dates as ISO
// strings (format: date-time), not JS Date objects. Modeling them as date-time
// strings lets the contract validator's date serDes round-trip the live Date values.
const dateTime = z.string().openapi({ format: 'date-time' });
const grantResponseSchema = grantSchema.extend({
  submittedAt: dateTime.nullable(),
  awardedAt: dateTime.nullable(),
  endAt: dateTime.nullable().optional(),
  createdAt: dateTime,
  updatedAt: dateTime,
});
const grantWithRelationsResponse = grantResponseSchema.extend({
  sponsor: sponsorSchema.optional(),
  pi: facultySchema.optional(),
  department: departmentSchema.optional(),
});
registry.register(
  'GrantWithRelations',
  grantWithRelationsResponse.openapi({ description: 'A grant with resolved sponsor/PI/department' })
);
const ErrorResponse = registry.register(
  'ErrorResponse',
  errorEnvelopeSchema.openapi({ description: 'Standard API error envelope' })
);

// Helper: standard error responses (each $refs the ErrorResponse component).
const ERR_DESC: Record<number, string> = {
  400: 'Validation error',
  401: 'Unauthorized — missing or invalid token',
  403: 'Forbidden — insufficient role',
  404: 'Resource not found',
  409: 'Conflict',
  422: 'Validation error',
  429: 'Too many requests',
  503: 'Service unavailable',
};
function errs(...codes: number[]): Record<number, unknown> {
  const out: Record<number, unknown> = {};
  for (const c of codes) {
    out[c] = {
      description: ERR_DESC[c] ?? 'Error',
      content: { 'application/json': { schema: ErrorResponse } },
    };
  }
  return out;
}

const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

// ── System ────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'get',
  path: '/api/health',
  operationId: 'getHealth',
  summary: 'Health check with DB and Redis latency',
  tags: ['System'],
  responses: {
    200: json(
      z
        .object({
          status: z.enum(['ok', 'degraded', 'unhealthy']),
          timestamp: z.string(),
          service: z.string(),
          checks: z.object({
            database: z.object({ status: z.enum(['ok', 'error']), latencyMs: z.number() }),
            redis: z.object({ status: z.enum(['ok', 'error']), latencyMs: z.number() }),
          }),
        })
        .openapi({}),
      'Service is healthy or degraded (Redis down)'
    ),
    503: { description: 'Service is unhealthy (database unreachable)' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/metrics',
  operationId: 'getPrometheusMetrics',
  summary: 'Prometheus metrics scrape endpoint',
  tags: ['System'],
  responses: {
    200: {
      description: 'Prometheus text format metrics',
      content: { 'text/plain': { schema: z.string().openapi({}) } },
    },
  },
});

// ── Auth ──────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  operationId: 'login',
  summary: 'Authenticate and receive a JWT',
  tags: ['Auth'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ email: z.string().email(), password: z.string().min(1) }).openapi({}),
        },
      },
      required: true,
    },
  },
  responses: {
    200: json(
      z
        .object({
          accessToken: z.string(),
          expiresIn: z.string(),
          user: z.object({
            id: z.number(),
            email: z.string().email(),
            name: z.string(),
            role: z.enum(['ADMIN', 'VIEWER']),
          }),
        })
        .openapi({}),
      'Login successful'
    ),
    ...errs(400, 401),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/logout',
  operationId: 'logout',
  summary: 'Revoke the current session token',
  tags: ['Auth'],
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: json(z.object({ message: z.string() }).openapi({}), 'Logged out'),
    ...errs(401),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/me',
  operationId: 'getCurrentUser',
  summary: 'Get the currently authenticated user',
  tags: ['Auth'],
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: json(
      z
        .object({
          user: z.object({ userId: z.number(), email: z.string().email(), role: z.string() }),
        })
        .openapi({}),
      'Current user details'
    ),
    ...errs(401),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/auth/change-password',
  operationId: 'changePassword',
  summary: "Change the current user's password",
  tags: ['Auth'],
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z
            .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) })
            .openapi({}),
        },
      },
      required: true,
    },
  },
  responses: {
    200: json(z.object({ message: z.string() }).openapi({}), 'Password changed successfully'),
    ...errs(400, 401),
  },
});

// ── Users (ADMIN) ───────────────────────────────────────────────────────────
const userRecord = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['ADMIN', 'VIEWER']),
  createdAt: dateTime,
});

registry.registerPath({
  method: 'get',
  path: '/api/users',
  operationId: 'listUsers',
  summary: 'List all users (ADMIN only)',
  tags: ['Users'],
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: json(
      z
        .object({
          items: z.array(userRecord),
          total: z.number(),
          page: z.number(),
          pageSize: z.number(),
          totalPages: z.number(),
        })
        .openapi({}),
      'Paginated user list'
    ),
    ...errs(401, 403),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/users',
  operationId: 'createUser',
  summary: 'Create a new user (ADMIN only)',
  tags: ['Users'],
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              email: z.string().email(),
              name: z.string().min(1).max(255),
              password: z.string().min(8),
              role: z.enum(['ADMIN', 'VIEWER']),
            })
            .openapi({}),
        },
      },
      required: true,
    },
  },
  responses: {
    201: json(userRecord.openapi({}), 'User created'),
    ...errs(401, 403, 422),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/users/{id}/role',
  operationId: 'updateUserRole',
  summary: "Update a user's role (ADMIN only)",
  tags: ['Users'],
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ description: 'User ID' }) }),
    body: {
      content: {
        'application/json': { schema: z.object({ role: z.enum(['ADMIN', 'VIEWER']) }).openapi({}) },
      },
      required: true,
    },
  },
  responses: {
    200: json(
      z
        .object({
          id: z.number(),
          email: z.string().email(),
          name: z.string(),
          role: z.enum(['ADMIN', 'VIEWER']),
        })
        .openapi({}),
      'User with updated role'
    ),
    ...errs(401, 403, 404),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/users/{id}',
  operationId: 'deleteUser',
  summary: 'Delete a user (ADMIN only)',
  tags: ['Users'],
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string().openapi({ description: 'User ID' }) }) },
  responses: {
    204: { description: 'User deleted' },
    ...errs(401, 403, 404),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/users/{id}/revoke-sessions',
  operationId: 'revokeUserSessions',
  summary: 'Revoke all active sessions for a user (ADMIN only)',
  tags: ['Users'],
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string().openapi({ description: 'User ID' }) }) },
  responses: {
    200: json(z.object({ message: z.string() }).openapi({}), 'Sessions revoked'),
    ...errs(400, 401, 403),
  },
});

// ── Metrics ───────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'get',
  path: '/api/metrics/summary',
  operationId: 'getMetricsSummary',
  summary: 'Aggregated research metrics',
  tags: ['Metrics'],
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: json(
      z
        .object({
          totalSubmissions: z.number(),
          totalAwardedAmount: z.number(),
          awardRate: z.number(),
          medianTimeToAward: z.number().nullable(),
        })
        .openapi({}),
      'Summary KPIs'
    ),
    ...errs(401),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/metrics/status-breakdown',
  operationId: 'getStatusBreakdown',
  summary: 'Grant counts grouped by status',
  tags: ['Metrics'],
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: json(
      z.array(z.object({ status: grantStatusSchema, count: z.number() })).openapi({}),
      'Status breakdown'
    ),
    ...errs(401),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/metrics/timeseries',
  operationId: 'getMetricsTimeseries',
  summary: 'Monthly submissions and awards over time',
  tags: ['Metrics'],
  security: [{ [bearerAuth.name]: [] }],
  request: { query: timeseriesQuerySchema.openapi({}) },
  responses: {
    200: json(
      z
        .array(
          z.object({
            month: z.string(),
            submissions: z.number(),
            awards: z.number(),
            awardedAmount: z.number(),
          })
        )
        .openapi({}),
      'Timeseries data array'
    ),
    ...errs(401),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/metrics/awards-by-sponsor-type',
  operationId: 'getAwardsBySponsorType',
  summary: 'Awarded amount grouped by sponsor type',
  tags: ['Metrics'],
  security: [{ [bearerAuth.name]: [] }],
  request: { query: awardsBySponsorTypeQuerySchema.openapi({}) },
  responses: {
    200: json(
      z
        .array(z.object({ sponsorType: z.string(), awardedAmount: z.number(), count: z.number() }))
        .openapi({}),
      'Sponsor type breakdown'
    ),
    ...errs(401),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/insights',
  operationId: 'getInsights',
  summary: 'Rich analytics dashboard payload',
  tags: ['Metrics'],
  security: [{ [bearerAuth.name]: [] }],
  request: { query: insightsQuerySchema.openapi({}) },
  responses: {
    200: json(
      z
        .object({
          summary: z.object({
            submissions: z.number(),
            awards: z.number(),
            awardRate: z.number(),
            totalAwardedAmount: z.number(),
            medianTimeToAward: z.number().nullable(),
            avgAwardSize: z.number(),
          }),
          timeseries: z.array(
            z.object({
              month: z.string(),
              submissions: z.number(),
              awards: z.number(),
              awardedAmount: z.number(),
              statusCounts: z.record(z.number()),
            })
          ),
          dailyActivity: z.array(
            z.object({
              date: z.string(),
              submissions: z.number(),
              awards: z.number(),
              awardedAmount: z.number(),
            })
          ),
          sponsorBreakdown: z.array(
            z.object({
              name: z.string(),
              sponsorType: z.string().nullable(),
              awardedAmount: z.number(),
              count: z.number(),
            })
          ),
          departmentBreakdown: z.array(
            z.object({
              departmentId: z.number(),
              name: z.string(),
              awardedAmount: z.number(),
              awards: z.number(),
              submissions: z.number(),
            })
          ),
          funnel: z.object({
            submitted: z.number(),
            underReview: z.number(),
            awarded: z.number(),
            declined: z.number(),
          }),
        })
        .openapi({}),
      'Insights dashboard data'
    ),
    ...errs(401),
  },
});

// ── Grants ────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'get',
  path: '/api/grants',
  operationId: 'listGrants',
  summary: 'List grants with filtering and pagination',
  tags: ['Grants'],
  security: [{ [bearerAuth.name]: [] }],
  request: { query: grantsQuerySchema.openapi({}) },
  responses: {
    200: json(
      z
        .object({
          items: z.array(grantResponseSchema),
          total: z.number(),
          page: z.number(),
          pageSize: z.number(),
        })
        .openapi({}),
      'Paginated grant list'
    ),
    ...errs(400, 401),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/grants/export',
  operationId: 'exportGrants',
  summary: 'Export filtered grants as CSV (or JSON with ?format=json)',
  tags: ['Grants'],
  security: [{ [bearerAuth.name]: [] }],
  request: {
    query: grantsQuerySchema
      .omit({ page: true, pageSize: true })
      .extend({ format: z.enum(['csv', 'json']).optional() })
      .openapi({}),
  },
  responses: {
    200: {
      description: 'Exported grants',
      content: {
        'text/csv': { schema: z.string().openapi({ description: 'CSV document' }) },
        'application/json': {
          schema: z.array(
            z.object({
              id: z.number(),
              title: z.string(),
              status: z.string(),
              amount: z.number(),
              pi: z.object({ name: z.string(), email: z.string() }),
              department: z.string(),
              sponsor: z.object({ name: z.string(), type: z.string() }),
              submittedAt: z.string().nullable(),
              awardedAt: z.string().nullable(),
            })
          ),
        },
      },
    },
    ...errs(400, 401),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/grants/expiring',
  operationId: 'getExpiringGrants',
  summary: 'Grants grouped into expiry buckets (0-30/31-60/61-90 days)',
  tags: ['Grants'],
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: json(
      z
        .object({
          buckets: z.array(
            z.object({
              label: z.enum(['0-30', '31-60', '61-90']),
              daysFrom: z.number(),
              daysTo: z.number(),
              count: z.number(),
              totalAmount: z.number(),
              grants: z.array(
                grantWithRelationsResponse.extend({
                  daysUntilExpiry: z.number(),
                  grantNumber: z.string().nullable().optional(),
                })
              ),
            })
          ),
          totalCount: z.number(),
          totalAmount: z.number(),
        })
        .openapi({}),
      'Expiring grants by bucket'
    ),
    ...errs(401),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/grants/{id}',
  operationId: 'getGrantById',
  summary: 'Get a single grant with its sponsor/PI/department',
  tags: ['Grants'],
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string().openapi({ description: 'Grant ID' }) }) },
  responses: {
    200: json(grantWithRelationsResponse.openapi({}), 'Grant detail'),
    ...errs(400, 401, 404),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/grants/{id}/similar',
  operationId: 'getSimilarGrants',
  summary: 'Semantically similar grants (vector search; empty when embeddings disabled)',
  tags: ['Grants'],
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ description: 'Grant ID' }) }),
    query: z.object({ k: z.coerce.number().int().positive().optional() }).openapi({}),
  },
  responses: {
    200: json(
      z
        .object({ items: z.array(grantWithRelationsResponse.extend({ score: z.number() })) })
        .openapi({}),
      'Similar grants'
    ),
    ...errs(400, 401),
  },
});

// ── Faculty ───────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'get',
  path: '/api/faculty/leaderboard',
  operationId: 'getFacultyLeaderboard',
  summary: 'Faculty ranked by total awarded amount',
  tags: ['Faculty'],
  security: [{ [bearerAuth.name]: [] }],
  request: { query: facultyLeaderboardQuerySchema.openapi({}) },
  responses: {
    200: json(
      z
        .array(
          z.object({
            facultyId: z.number(),
            facultyName: z.string(),
            departmentName: z.string(),
            totalAwarded: z.number(),
            rank: z.number(),
          })
        )
        .openapi({}),
      'Ranked faculty list'
    ),
    ...errs(401),
  },
});

// ── Departments / Sponsors ──────────────────────────────────────────────────
registry.registerPath({
  method: 'get',
  path: '/api/departments',
  operationId: 'listDepartments',
  summary: 'List all departments',
  tags: ['Reference'],
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: json(z.array(departmentSchema).openapi({}), 'Departments'),
    ...errs(401),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/sponsors',
  operationId: 'listSponsors',
  summary: 'List all sponsors',
  tags: ['Reference'],
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: json(z.array(sponsorSchema).openapi({}), 'Sponsors'),
    ...errs(401),
  },
});

// ── AI ────────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'post',
  path: '/api/ask',
  operationId: 'askQuestion',
  summary: 'Ask a natural-language question (RAG, streamed as SSE)',
  tags: ['AI'],
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: z.object({ question: z.string() }).openapi({}) } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Server-sent event stream (event: text | sources | done)',
      content: { 'text/event-stream': { schema: z.string().openapi({}) } },
    },
    ...errs(400, 503),
  },
});

// ── Ingestion (ADMIN) ────────────────────────────────────────────────────────
registry.registerPath({
  method: 'post',
  path: '/api/ingest/grants',
  operationId: 'ingestGrants',
  summary: 'Ingest grants from CSV (async; returns a job acknowledgement)',
  tags: ['Ingestion'],
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: { 'text/plain': { schema: z.string().openapi({ description: 'CSV file content' }) } },
      required: true,
    },
  },
  responses: {
    202: json(
      z
        .object({
          jobId: z.string(),
          status: z.enum(['queued', 'completed']),
          totalRows: z.number(),
          batches: z.number(),
          errors: z.array(z.object({ row: z.number(), error: z.string() })),
        })
        .openapi({}),
      'Ingestion accepted (async job)'
    ),
    ...errs(401, 403),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/ingest/jobs/{id}',
  operationId: 'getIngestJob',
  summary: 'Get the status of an ingestion job (ADMIN only)',
  tags: ['Ingestion'],
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string().openapi({ description: 'Job ID' }) }) },
  responses: {
    200: json(
      z
        .object({
          jobId: z.string(),
          status: z.enum(['queued', 'processing', 'completed']),
          totalRows: z.number(),
          totalBatches: z.number(),
          batchesDone: z.number(),
          inserted: z.number(),
          updated: z.number(),
          errors: z.array(z.object({ row: z.number(), error: z.string() })),
          createdAt: z.string(),
          updatedAt: z.string(),
        })
        .openapi({}),
      'Ingestion job status'
    ),
    ...errs(401, 403, 404),
  },
});

// ── Reconciliation (ADMIN) ───────────────────────────────────────────────────
registry.registerPath({
  method: 'post',
  path: '/api/reconcile',
  operationId: 'reconcileGrants',
  summary: 'Dry-run reconciliation of a CSV against DB state (ADMIN only)',
  tags: ['Reconciliation'],
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: { 'text/plain': { schema: z.string().openapi({ description: 'CSV file content' }) } },
      required: true,
    },
  },
  responses: {
    200: json(
      z
        .object({
          summary: z.object({
            totalRows: z.number(),
            parseErrors: z.number(),
            matched: z.number(),
            new: z.number(),
            discrepant: z.number(),
            dataQualityViolations: z.number(),
          }),
          parseErrors: z.array(z.object({ row: z.number(), error: z.string() })),
          dataQualityViolations: z.array(
            z.object({
              row: z.number(),
              grantNumber: z.string().optional(),
              title: z.string(),
              piEmail: z.string(),
              violations: z.array(z.string()),
            })
          ),
          discrepancies: z.array(
            z.object({
              grantNumber: z.string().optional(),
              title: z.string(),
              piEmail: z.string(),
              field: z.string(),
              csvValue: z.union([z.string(), z.number()]),
              dbValue: z.union([z.string(), z.number()]),
            })
          ),
          new: z.array(
            z.object({
              grantNumber: z.string().optional(),
              title: z.string(),
              piEmail: z.string(),
              department: z.string(),
              amount: z.number(),
              status: z.string(),
            })
          ),
        })
        .openapi({}),
      'Reconciliation report'
    ),
    ...errs(401, 403),
  },
});

export function buildDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'UF Research Metrics API',
      version: '0.1.0',
      description:
        'Internal analytics API for UF Office of Research — grant activity, faculty productivity, and institutional research metrics.',
    },
    servers: [{ url: 'http://localhost:3001', description: 'Local development' }],
  });
}

// Only write the file when executed directly (not when imported by the freshness test).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const document = buildDocument();
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outDir = join(__dirname, '../packages/shared/dist');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI spec written to ${outPath}`);
}
