-- AlterTable
ALTER TABLE "TaskItem" ADD COLUMN     "sourceBlockId" TEXT,
ADD COLUMN     "sourceDocId" TEXT;

-- CreateIndex
CREATE INDEX "TaskItem_sourceDocId_idx" ON "TaskItem"("sourceDocId");

-- AddForeignKey
ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "Doc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

