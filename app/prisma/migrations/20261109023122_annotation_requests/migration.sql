-- AlterTable
ALTER TABLE "Annotation" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "claimedBy" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "lastAgentAt" TIMESTAMP(3),
ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "seenAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT,
ADD COLUMN     "taskId" TEXT;

-- AlterTable
ALTER TABLE "EditProposal" ADD COLUMN     "annotationId" TEXT;

-- CreateTable
CREATE TABLE "AnnotationMessage" (
    "id" TEXT NOT NULL,
    "annotationId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnotationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnnotationMessage_annotationId_createdAt_idx" ON "AnnotationMessage"("annotationId", "createdAt");

-- CreateIndex
CREATE INDEX "Annotation_taskId_idx" ON "Annotation"("taskId");

-- CreateIndex
CREATE INDEX "Annotation_status_updatedAt_idx" ON "Annotation"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "EditProposal_annotationId_idx" ON "EditProposal"("annotationId");

-- AddForeignKey
ALTER TABLE "EditProposal" ADD CONSTRAINT "EditProposal_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "Annotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TaskItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationMessage" ADD CONSTRAINT "AnnotationMessage_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "Annotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
