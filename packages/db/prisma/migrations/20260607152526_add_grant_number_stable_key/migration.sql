/*
  Warnings:

  - A unique constraint covering the columns `[grantNumber]` on the table `grants` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "grants" ADD COLUMN     "grantNumber" VARCHAR(50);

-- CreateIndex
CREATE UNIQUE INDEX "grants_grantNumber_key" ON "grants"("grantNumber");
