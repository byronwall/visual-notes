-- CreateEnum
CREATE TYPE "PersonContactKind" AS ENUM ('email', 'phone', 'url', 'social', 'address', 'other');

-- CreateTable
CREATE TABLE "PersonContact" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "kind" "PersonContactKind" NOT NULL,
    "label" TEXT,
    "value" TEXT NOT NULL,
    "matchValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT,
    "summary" TEXT,
    "url" TEXT,
    "docId" TEXT,
    "requestKey" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonAffiliation" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT,
    "startOn" DATE,
    "endOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonAffiliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonDocLink" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonDocLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonContact_personId_idx" ON "PersonContact"("personId");

-- CreateIndex
CREATE INDEX "PersonContact_kind_matchValue_idx" ON "PersonContact"("kind", "matchValue");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_requestKey_key" ON "Organization"("requestKey");

-- CreateIndex
CREATE INDEX "Organization_name_idx" ON "Organization"("name");

-- CreateIndex
CREATE INDEX "PersonAffiliation_personId_idx" ON "PersonAffiliation"("personId");

-- CreateIndex
CREATE INDEX "PersonAffiliation_organizationId_idx" ON "PersonAffiliation"("organizationId");

-- CreateIndex
CREATE INDEX "PersonDocLink_docId_idx" ON "PersonDocLink"("docId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonDocLink_personId_docId_key" ON "PersonDocLink"("personId", "docId");

-- AddForeignKey
ALTER TABLE "PersonContact" ADD CONSTRAINT "PersonContact_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonAffiliation" ADD CONSTRAINT "PersonAffiliation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonAffiliation" ADD CONSTRAINT "PersonAffiliation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonDocLink" ADD CONSTRAINT "PersonDocLink_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonDocLink" ADD CONSTRAINT "PersonDocLink_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
