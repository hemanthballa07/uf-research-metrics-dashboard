-- AlterTable: add endAt column to grants for expiry tracking
ALTER TABLE "grants" ADD COLUMN "endAt" TIMESTAMP;

-- CreateIndex
CREATE INDEX "grants_endAt_idx" ON "grants"("endAt");
