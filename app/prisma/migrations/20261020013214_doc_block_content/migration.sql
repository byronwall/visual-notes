-- AlterTable
ALTER TABLE "Doc" ADD COLUMN     "content" JSONB,
ADD COLUMN     "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "contentVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "DocRevision" ADD COLUMN     "content" JSONB;

