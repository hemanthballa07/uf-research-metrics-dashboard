-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsors" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sponsorType" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grants" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "sponsorId" INTEGER NOT NULL,
    "piId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "submittedAt" TIMESTAMP,
    "awardedAt" TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE INDEX "departments_name_idx" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "faculty_email_key" ON "faculty"("email");

-- CreateIndex
CREATE INDEX "faculty_departmentId_idx" ON "faculty"("departmentId");

-- CreateIndex
CREATE INDEX "faculty_email_idx" ON "faculty"("email");

-- CreateIndex
CREATE INDEX "sponsors_sponsorType_idx" ON "sponsors"("sponsorType");

-- CreateIndex
CREATE INDEX "sponsors_name_idx" ON "sponsors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sponsors_name_sponsorType_key" ON "sponsors"("name", "sponsorType");

-- CreateIndex
CREATE INDEX "grants_sponsorId_idx" ON "grants"("sponsorId");

-- CreateIndex
CREATE INDEX "grants_piId_idx" ON "grants"("piId");

-- CreateIndex
CREATE INDEX "grants_departmentId_idx" ON "grants"("departmentId");

-- CreateIndex
CREATE INDEX "grants_status_idx" ON "grants"("status");

-- CreateIndex
CREATE INDEX "grants_submittedAt_idx" ON "grants"("submittedAt");

-- CreateIndex
CREATE INDEX "grants_awardedAt_idx" ON "grants"("awardedAt");

-- AddForeignKey
ALTER TABLE "faculty" ADD CONSTRAINT "faculty_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grants" ADD CONSTRAINT "grants_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "sponsors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grants" ADD CONSTRAINT "grants_piId_fkey" FOREIGN KEY ("piId") REFERENCES "faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grants" ADD CONSTRAINT "grants_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
