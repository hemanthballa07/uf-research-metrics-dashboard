/*
  Warnings:

  - Changed the type of `status` on the `grants` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `sponsorType` on the `sponsors` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "GrantStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'AWARDED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SponsorType" AS ENUM ('FEDERAL', 'STATE', 'INDUSTRY', 'FOUNDATION', 'INTERNAL', 'OTHER');

-- AlterTable
ALTER TABLE "grants" DROP COLUMN "status",
ADD COLUMN     "status" "GrantStatus" NOT NULL;

-- AlterTable
ALTER TABLE "sponsors" DROP COLUMN "sponsorType",
ADD COLUMN     "sponsorType" "SponsorType" NOT NULL;

-- CreateTable
CREATE TABLE "grant_co_pis" (
    "grantId" INTEGER NOT NULL,
    "facultyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grant_co_pis_pkey" PRIMARY KEY ("grantId","facultyId")
);

-- CreateIndex
CREATE INDEX "grants_status_idx" ON "grants"("status");

-- CreateIndex
CREATE INDEX "sponsors_sponsorType_idx" ON "sponsors"("sponsorType");

-- CreateIndex
CREATE UNIQUE INDEX "sponsors_name_sponsorType_key" ON "sponsors"("name", "sponsorType");

-- AddForeignKey
ALTER TABLE "grant_co_pis" ADD CONSTRAINT "grant_co_pis_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_co_pis" ADD CONSTRAINT "grant_co_pis_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
