-- CreateEnum
CREATE TYPE "ResearchCardType" AS ENUM ('task', 'question', 'finding', 'source', 'summary', 'option', 'criterion');

-- CreateEnum
CREATE TYPE "ResearchCardState" AS ENUM ('open', 'done', 'dropped');

-- CreateEnum
CREATE TYPE "ResearchSummaryStatus" AS ENUM ('draft', 'accepted');

-- CreateTable
CREATE TABLE "ResearchTopic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchBatch" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "batchKey" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "ResearchBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchCard" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "type" "ResearchCardType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "state" "ResearchCardState",
    "url" TEXT,
    "snippet" TEXT,
    "imageUrl" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "nudgeX" DOUBLE PRECISION,
    "nudgeY" DOUBLE PRECISION,
    "batchId" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchLink" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'relates_to',
    "batchId" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSummaryGroup" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "summaryCardId" TEXT NOT NULL,
    "status" "ResearchSummaryStatus" NOT NULL DEFAULT 'draft',
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchSummaryGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSummaryMember" (
    "groupId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,

    CONSTRAINT "ResearchSummaryMember_pkey" PRIMARY KEY ("groupId","cardId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchTopic_slug_key" ON "ResearchTopic"("slug");

-- CreateIndex
CREATE INDEX "ResearchBatch_topicId_createdAt_idx" ON "ResearchBatch"("topicId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchBatch_topicId_batchKey_key" ON "ResearchBatch"("topicId", "batchKey");

-- CreateIndex
CREATE INDEX "ResearchCard_topicId_hiddenAt_idx" ON "ResearchCard"("topicId", "hiddenAt");

-- CreateIndex
CREATE INDEX "ResearchCard_parentId_idx" ON "ResearchCard"("parentId");

-- CreateIndex
CREATE INDEX "ResearchCard_batchId_idx" ON "ResearchCard"("batchId");

-- CreateIndex
CREATE INDEX "ResearchLink_topicId_idx" ON "ResearchLink"("topicId");

-- CreateIndex
CREATE INDEX "ResearchLink_fromId_idx" ON "ResearchLink"("fromId");

-- CreateIndex
CREATE INDEX "ResearchLink_toId_idx" ON "ResearchLink"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchSummaryGroup_summaryCardId_key" ON "ResearchSummaryGroup"("summaryCardId");

-- CreateIndex
CREATE INDEX "ResearchSummaryGroup_topicId_idx" ON "ResearchSummaryGroup"("topicId");

-- CreateIndex
CREATE INDEX "ResearchSummaryMember_cardId_idx" ON "ResearchSummaryMember"("cardId");

-- AddForeignKey
ALTER TABLE "ResearchBatch" ADD CONSTRAINT "ResearchBatch_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ResearchTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchCard" ADD CONSTRAINT "ResearchCard_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ResearchTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchCard" ADD CONSTRAINT "ResearchCard_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ResearchBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchCard" ADD CONSTRAINT "ResearchCard_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ResearchCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchLink" ADD CONSTRAINT "ResearchLink_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ResearchTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchLink" ADD CONSTRAINT "ResearchLink_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "ResearchCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchLink" ADD CONSTRAINT "ResearchLink_toId_fkey" FOREIGN KEY ("toId") REFERENCES "ResearchCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchLink" ADD CONSTRAINT "ResearchLink_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ResearchBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSummaryGroup" ADD CONSTRAINT "ResearchSummaryGroup_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ResearchTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSummaryGroup" ADD CONSTRAINT "ResearchSummaryGroup_summaryCardId_fkey" FOREIGN KEY ("summaryCardId") REFERENCES "ResearchCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSummaryGroup" ADD CONSTRAINT "ResearchSummaryGroup_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ResearchBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSummaryMember" ADD CONSTRAINT "ResearchSummaryMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ResearchSummaryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSummaryMember" ADD CONSTRAINT "ResearchSummaryMember_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "ResearchCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
