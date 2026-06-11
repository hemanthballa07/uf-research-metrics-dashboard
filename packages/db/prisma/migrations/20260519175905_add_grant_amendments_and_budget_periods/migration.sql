-- CreateEnum
CREATE TYPE "AmendmentKind" AS ENUM ('NO_COST_EXTENSION', 'REBUDGET', 'SCOPE_CHANGE', 'PI_CHANGE', 'SUPPLEMENT', 'TERMINATION');

-- CreateEnum
CREATE TYPE "BudgetPeriodStatus" AS ENUM ('PROJECTED', 'ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "grant_amendments" (
    "id" SERIAL NOT NULL,
    "grantId" INTEGER NOT NULL,
    "amendmentNumber" INTEGER NOT NULL,
    "kind" "AmendmentKind" NOT NULL,
    "effectiveAt" TIMESTAMP NOT NULL,
    "amountDelta" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grant_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant_budget_periods" (
    "id" SERIAL NOT NULL,
    "grantId" INTEGER NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "startAt" TIMESTAMP NOT NULL,
    "endAt" TIMESTAMP NOT NULL,
    "directCosts" DECIMAL(15,2) NOT NULL,
    "indirectCosts" DECIMAL(15,2) NOT NULL,
    "status" "BudgetPeriodStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grant_budget_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grant_amendments_grantId_idx" ON "grant_amendments"("grantId");

-- CreateIndex
CREATE INDEX "grant_amendments_kind_idx" ON "grant_amendments"("kind");

-- CreateIndex
CREATE INDEX "grant_amendments_effectiveAt_idx" ON "grant_amendments"("effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "grant_amendments_grantId_amendmentNumber_key" ON "grant_amendments"("grantId", "amendmentNumber");

-- CreateIndex
CREATE INDEX "grant_budget_periods_grantId_idx" ON "grant_budget_periods"("grantId");

-- CreateIndex
CREATE INDEX "grant_budget_periods_status_idx" ON "grant_budget_periods"("status");

-- CreateIndex
CREATE INDEX "grant_budget_periods_startAt_idx" ON "grant_budget_periods"("startAt");

-- CreateIndex
CREATE INDEX "grant_budget_periods_endAt_idx" ON "grant_budget_periods"("endAt");

-- CreateIndex
CREATE UNIQUE INDEX "grant_budget_periods_grantId_periodNumber_key" ON "grant_budget_periods"("grantId", "periodNumber");

-- AddForeignKey
ALTER TABLE "grant_amendments" ADD CONSTRAINT "grant_amendments_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_budget_periods" ADD CONSTRAINT "grant_budget_periods_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
