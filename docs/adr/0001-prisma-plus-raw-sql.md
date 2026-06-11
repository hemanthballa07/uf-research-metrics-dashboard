# ADR-0001: Hybrid Prisma + raw SQL for analytics queries

- **Status:** Accepted
- **Date:** 2026-05-04
- **Deciders:** Project lead

## Context

The platform serves two query shapes:

1. **CRUD operations** — fetch grants by id, list with filters, upsert during
   CSV ingestion. Bog-standard relational work, ideally written in TypeScript
   with type safety.
2. **Analytics queries** — faculty leaderboard with `RANK() OVER (PARTITION BY
   department)`, time-to-award percentiles via `PERCENTILE_CONT`, CTEs that
   join 4+ tables. Prisma's query builder lacks window functions and produces
   suboptimal SQL for these shapes.

Two extremes were considered:

- **Pure Prisma** — type-safe and pleasant, but window functions / CTEs would
  require generating SQL out-of-band or accepting N+1 round trips. Faculty
  leaderboard performance would tank at >10K grants.
- **Pure raw SQL** (e.g., Kysely or a query-builder library) — gives us full
  PostgreSQL surface but throws away Prisma's auto-generated types and
  migration tooling, which the rest of the project benefits from.

## Decision

**Use Prisma as the default ORM. Drop to `prisma.$queryRaw` only for queries
that need PostgreSQL features Prisma's query builder doesn't support
(window functions, CTEs, `PERCENTILE_CONT`).**

Concretely:

- All schema, migrations, and CRUD via Prisma.
- Analytics services (`apps/api/src/services/insightsService.ts`,
  `facultyService.ts`, `metricsService.ts`) use `$queryRaw` with parameter
  interpolation — never string concatenation.
- Raw queries return narrowly-typed results via `$queryRaw<RowShape[]>`,
  validated at the service boundary with Zod when shape complexity warrants it.

## Consequences

**Positive:**
- Leaderboard with `RANK() OVER` runs in a single round trip; k6 measures
  p95 = 84 ms at 80K grants (`docs/BENCHMARKS.md`).
- Schema / migration / type-generation tooling stays Prisma-managed —
  one source of truth for the DDL.

**Negative:**
- Two query styles in the codebase. New contributors must learn both.
- Raw queries don't benefit from Prisma's auto-generated types; row shapes
  are hand-typed and could drift from the schema. Mitigation: each raw
  query has a unit test asserting the column-name contract.

**Neutral:**
- If Prisma 6+ adds window-function support in the query builder, some
  raw queries can be migrated back. Tracked as a follow-up, not a blocker.
