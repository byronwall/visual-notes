-- CreateTable
CREATE TABLE "NoteAssessment" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "questionSetVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "bucket" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "inputTokens" INTEGER,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NoteAssessment_docId_key" ON "NoteAssessment"("docId");

-- CreateIndex
CREATE INDEX "NoteAssessment_bucket_confidence_idx" ON "NoteAssessment"("bucket", "confidence" DESC);

-- AddForeignKey
ALTER TABLE "NoteAssessment" ADD CONSTRAINT "NoteAssessment_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

