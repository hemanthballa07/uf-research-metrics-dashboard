-- AddUniqueConstraint
-- Enables idempotent upserts in the ingestion pipeline by ensuring
-- (title, piId) uniquely identifies a grant record.
CREATE UNIQUE INDEX "grants_title_piId_key" ON "grants"("title", "piId");
