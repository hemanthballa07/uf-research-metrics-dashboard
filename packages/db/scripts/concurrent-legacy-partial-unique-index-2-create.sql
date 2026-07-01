-- Zero-downtime equivalent of migrations/20260607184208_grant_legacy_partial_unique.
--
-- That migration's plain DROP INDEX / CREATE UNIQUE INDEX takes an ACCESS
-- EXCLUSIVE lock on "grants" for the duration of the index build. Fine for an
-- empty/small table (CI, fresh dev installs keep using the migration as-is),
-- but not acceptable against an already-large production table.
--
-- Prisma's migration engine always runs migration.sql inside a transaction,
-- and `prisma db execute --file` sends a whole multi-statement file as one
-- batch (Postgres implicitly wraps that in a transaction too) — CONCURRENTLY
-- cannot run inside either. Confirmed by hand:
--   - `prisma migrate deploy` fails with P3018 / Postgres 25001.
--   - `prisma db execute --file <single file with both statements>` fails
--     the same way.
-- So this has to run as two separate `db execute` invocations, one statement
-- per file, before this migration is deployed to such an environment:
--
--   prisma db execute --file packages/db/scripts/concurrent-legacy-partial-unique-index-1-drop.sql --url "$DATABASE_URL"
--   prisma db execute --file packages/db/scripts/concurrent-legacy-partial-unique-index-2-create.sql --url "$DATABASE_URL"
--   prisma migrate resolve --applied 20260607184208_grant_legacy_partial_unique
--   prisma migrate deploy   # applies everything else normally
--
-- Idempotent (IF EXISTS / IF NOT EXISTS) — safe to run whether or not the
-- original migration already applied on this database.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "grants_title_piId_legacy_key"
  ON "grants" ("title", "piId")
  WHERE "grantNumber" IS NULL;
