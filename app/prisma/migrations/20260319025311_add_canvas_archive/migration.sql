-- CreateEnum
CREATE TYPE "ArchiveCanvasCardMode" AS ENUM ('compact', 'summary', 'rich');

-- AlterTable
ALTER TABLE "ArchivedPage" ADD COLUMN     "canvasCardMode" "ArchiveCanvasCardMode" NOT NULL DEFAULT 'summary',
ADD COLUMN     "canvasX" DOUBLE PRECISION,
ADD COLUMN     "canvasY" DOUBLE PRECISION;
