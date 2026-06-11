-- Replace the unconditional (title, piId) unique with one scoped to legacy rows
-- (no stable grantNumber). Rows that carry a grantNumber are deduped by the
-- grants_grantNumber_key index instead, and may freely share (title, piId)
-- (e.g. competing renewals).
DROP INDEX "grants_title_piId_key";

CREATE UNIQUE INDEX "grants_title_piId_legacy_key"
  ON "grants" ("title", "piId")
  WHERE "grantNumber" IS NULL;
