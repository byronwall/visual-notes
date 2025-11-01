-- AlterTable
ALTER TABLE "Doc" ADD COLUMN     "meta" JSONB,
ADD COLUMN     "path" TEXT;

-- CreateIndex
CREATE INDEX "Doc_path_idx" ON "Doc"("path");
