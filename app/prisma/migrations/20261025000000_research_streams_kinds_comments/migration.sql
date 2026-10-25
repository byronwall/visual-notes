-- AlterTable
ALTER TABLE "ResearchTopic" ADD COLUMN     "answer" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "kinds" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ResearchCard" ADD COLUMN     "fields" JSONB,
ADD COLUMN     "gist" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "kind" TEXT,
ADD COLUMN     "streamId" TEXT;

-- CreateTable
CREATE TABLE "ResearchStream" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL DEFAULT '',
    "answer" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "batchId" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchComment" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "cardId" TEXT,
    "streamId" TEXT,
    "body" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'you',
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchStream_topicId_idx" ON "ResearchStream"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchStream_topicId_key_key" ON "ResearchStream"("topicId", "key");

-- CreateIndex
CREATE INDEX "ResearchComment_topicId_resolvedAt_idx" ON "ResearchComment"("topicId", "resolvedAt");

-- CreateIndex
CREATE INDEX "ResearchComment_cardId_idx" ON "ResearchComment"("cardId");

-- CreateIndex
CREATE INDEX "ResearchCard_streamId_idx" ON "ResearchCard"("streamId");

-- AddForeignKey
ALTER TABLE "ResearchStream" ADD CONSTRAINT "ResearchStream_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ResearchTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchStream" ADD CONSTRAINT "ResearchStream_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ResearchBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchComment" ADD CONSTRAINT "ResearchComment_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ResearchTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchComment" ADD CONSTRAINT "ResearchComment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "ResearchCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchComment" ADD CONSTRAINT "ResearchComment_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "ResearchStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchCard" ADD CONSTRAINT "ResearchCard_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "ResearchStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

