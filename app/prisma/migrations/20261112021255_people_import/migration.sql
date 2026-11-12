-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "mergedIntoId" TEXT;

-- CreateTable
CREATE TABLE "PersonExternalIdentity" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "lastImportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonExternalIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeopleImport" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeopleImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeopleImportRow" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "outcome" TEXT,
    "personId" TEXT,
    "message" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeopleImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonExternalIdentity_personId_idx" ON "PersonExternalIdentity"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonExternalIdentity_source_externalKey_key" ON "PersonExternalIdentity"("source", "externalKey");

-- CreateIndex
CREATE UNIQUE INDEX "PeopleImportRow_importId_rowIndex_key" ON "PeopleImportRow"("importId", "rowIndex");

-- AddForeignKey
ALTER TABLE "PersonExternalIdentity" ADD CONSTRAINT "PersonExternalIdentity_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeopleImportRow" ADD CONSTRAINT "PeopleImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "PeopleImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
