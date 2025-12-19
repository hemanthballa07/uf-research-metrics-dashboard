// Shared Zod validation schemas
import { z } from 'zod';

export const grantStatusSchema = z.enum([
  'draft',
  'submitted',
  'under_review',
  'awarded',
  'declined',
]);

export const sponsorTypeSchema = z.enum([
  'federal',
  'state',
  'foundation',
  'corporate',
  'other',
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
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createGrantSchema = grantSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateGrantSchema = createGrantSchema.partial();

// CSV import schema (for ingestion endpoint)
export const csvGrantRowSchema = z.object({
  title: z.string().min(1),
  sponsor_name: z.string().min(1),
  sponsor_type: sponsorTypeSchema,
  pi_name: z.string().min(1),
  pi_email: z.string().email(),
  department_name: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  status: grantStatusSchema,
  submitted_at: z.coerce.date().nullable().optional(),
  awarded_at: z.coerce.date().nullable().optional(),
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

