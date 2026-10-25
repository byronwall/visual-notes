-- AlterTable
ALTER TABLE "Doc" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedIntoId" TEXT;

-- CreateTable
CREATE TABLE "DocTombstone" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "path" TEXT,
    "archivedAt" TIMESTAMP(3) NOT NULL,
    "archiveReason" TEXT,
    "redirectDocId" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocTombstone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocTombstone_redirectDocId_idx" ON "DocTombstone"("redirectDocId");

-- CreateIndex
CREATE INDEX "Doc_archivedAt_idx" ON "Doc"("archivedAt");

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_archivedIntoId_fkey" FOREIGN KEY ("archivedIntoId") REFERENCES "Doc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

