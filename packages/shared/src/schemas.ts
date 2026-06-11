// Shared Zod validation schemas
import { z } from 'zod';

export const grantStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'AWARDED',
  'DECLINED',
  'WITHDRAWN',
]);

export const sponsorTypeSchema = z.enum([
  'FEDERAL',
  'STATE',
  'FOUNDATION',
  'INDUSTRY',
  'INTERNAL',
  'OTHER',
]);

export const departmentSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
});

export const facultySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  email: z.string().email(),
  departmentId: z.number().int().positive(),
});

export const sponsorSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  sponsorType: sponsorTypeSchema,
});

export const grantSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  sponsorId: z.number().int().positive(),
  piId: z.number().int().positive(),
  departmentId: z.number().int().positive(),
  amount: z.number().nonnegative(),
  status: grantStatusSchema,
  submittedAt: z.date().nullable(),
  awardedAt: z.date().nullable(),
  endAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createGrantSchema = grantSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateGrantSchema = createGrantSchema.partial();

// Grant with its resolved relations — returned by GET /api/grants/:id,
// /api/grants/expiring buckets, and /api/grants/:id/similar.
export const grantWithRelationsSchema = grantSchema.extend({
  sponsor: sponsorSchema.optional(),
  pi: facultySchema.optional(),
  department: departmentSchema.optional(),
});

// Standardized API error envelope — mirrors createErrorResponse() in errors.ts.
export const errorEnvelopeSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string(),
    statusCode: z.number().int(),
    timestamp: z.string(),
    fields: z.record(z.array(z.string())).optional(),
  }),
});

// CSV import schema (for ingestion endpoint)
export const csvGrantRowSchema = z.object({
  title: z.string().min(1),
  // UF internal Award ID (myUFL/PeopleSoft Grants) carried by UFIRST-originated
  // awards — NOT the sponsor's federal award number, which mutates per budget
  // period (e.g. NIH 5R01CA123456-03). Optional during the transition: legacy
  // exports omit it and fall back to the (title, piId) path; when present it is
  // the canonical idempotency key.
  grant_number: z.string().trim().min(1).optional(),
  sponsor_name: z.string().min(1),
  sponsor_type: sponsorTypeSchema,
  pi_name: z.string().min(1),
  pi_email: z.string().email(),
  department_name: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  status: grantStatusSchema,
  submitted_at: z.coerce.date().nullable().optional(),
  awarded_at: z.coerce.date().nullable().optional(),
  end_at: z.coerce.date().nullable().optional(),
});

// Query parameter schemas
export const grantsQuerySchema = z.object({
  department: z.coerce.number().int().positive().optional(),
  sponsor: z.coerce.number().int().positive().optional(),
  status: grantStatusSchema.optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const facultyLeaderboardQuerySchema = z.object({
  department: z.coerce.number().int().positive().optional(),
});

export const timeseriesQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(36).default(12),
});

export const awardsBySponsorTypeQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(36).default(12),
});

export const insightsQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(36).default(12),
  departmentId: z.coerce.number().int().positive().optional(),
  sponsorType: z.string().optional(),
  status: z.string().optional(), // Comma-separated list
});

