-- AlterTable
ALTER TABLE "UmapRun" ADD COLUMN     "alignment" JSONB,
ADD COLUMN     "trainedDocCount" INTEGER;

-- Backfill: existing maps count new notes from now on.
UPDATE "UmapRun" r
SET "trainedDocCount" = (SELECT COUNT(*)::int FROM "UmapPoint" p WHERE p."runId" = r."id");
