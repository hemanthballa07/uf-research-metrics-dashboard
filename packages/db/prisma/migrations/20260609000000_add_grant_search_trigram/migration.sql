-- B17 follow-up: trigram GIN indexes for faceted grant search.
--
-- The grants list/search (`GET /api/grants?search=`) and the export run
--   title ILIKE '%term%' OR pi.name ILIKE '%term%'
-- (apps/api/src/services/grantsService.ts, exportService.ts). With no usable index this is a
-- sequential scan over the 40K-row grants table — the dominant read-path ceiling bottleneck
-- found in B17 load testing (see docs/BENCHMARKS.md "Concurrency ceiling"). A pg_trgm GIN index
-- lets ILIKE '%substring%' (leading-wildcard) use an index instead of scanning.
--
-- Hand-authored raw SQL: Prisma cannot express GIN / gin_trgm_ops indexes in schema.prisma.
-- Apply with `prisma migrate deploy`; never `prisma migrate dev` against this DB (it would flag
-- these indexes as drift, exactly like the pgvector HNSW index in 20260520000000_add_grant_embeddings).
--
-- Prod note: plain (non-CONCURRENTLY) CREATE INDEX takes a SHARE lock that blocks writes for the
-- build duration. On a large production table, build these with CREATE INDEX CONCURRENTLY outside a
-- migration transaction — the same zero-downtime trade-off documented for the partial-index migration.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "grants_title_trgm" ON "grants" USING GIN ("title" gin_trgm_ops);

CREATE INDEX "faculty_name_trgm" ON "faculty" USING GIN ("name" gin_trgm_ops);
