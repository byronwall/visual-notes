-- AlterTable
ALTER TABLE "UmapRun" ADD COLUMN     "regionsJson" JSONB,
ADD COLUMN     "regionsUpdatedAt" TIMESTAMP(3);
