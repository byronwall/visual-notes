-- AlterTable
ALTER TABLE "DocEmbedding" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "sectionCount" INTEGER,
ADD COLUMN     "tokenCount" INTEGER;

-- CreateTable
CREATE TABLE "DocSection" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "headingPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "text" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "charCount" INTEGER NOT NULL,
    "tokenCount" INTEGER,

    CONSTRAINT "DocSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocSectionEmbedding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "vector" DOUBLE PRECISION[],
    "tokenCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocSectionEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocSection_docId_orderIndex_idx" ON "DocSection"("docId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "DocSection_docId_contentHash_key" ON "DocSection"("docId", "contentHash");

-- CreateIndex
CREATE INDEX "DocSectionEmbedding_docId_idx" ON "DocSectionEmbedding"("docId");

-- CreateIndex
CREATE UNIQUE INDEX "DocSectionEmbedding_runId_sectionId_key" ON "DocSectionEmbedding"("runId", "sectionId");

-- CreateIndex
CREATE INDEX "DocEmbedding_contentHash_idx" ON "DocEmbedding"("contentHash");

-- AddForeignKey
ALTER TABLE "DocSection" ADD CONSTRAINT "DocSection_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocSectionEmbedding" ADD CONSTRAINT "DocSectionEmbedding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EmbeddingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocSectionEmbedding" ADD CONSTRAINT "DocSectionEmbedding_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocSectionEmbedding" ADD CONSTRAINT "DocSectionEmbedding_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "DocSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
