-- CreateTable
CREATE TABLE "DocBlock" (
    "docId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "topLevelIndex" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attrs" JSONB,
    "hash" TEXT NOT NULL,

    CONSTRAINT "DocBlock_pkey" PRIMARY KEY ("docId","id")
);

-- CreateTable
CREATE TABLE "DocLink" (
    "id" TEXT NOT NULL,
    "sourceDocId" TEXT NOT NULL,
    "sourceBlockId" TEXT NOT NULL,
    "targetDocId" TEXT NOT NULL,
    "targetBlockId" TEXT,

    CONSTRAINT "DocLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocBlock_id_idx" ON "DocBlock"("id");

-- CreateIndex
CREATE INDEX "DocBlock_tags_idx" ON "DocBlock" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "DocLink_sourceDocId_idx" ON "DocLink"("sourceDocId");

-- CreateIndex
CREATE INDEX "DocLink_targetDocId_idx" ON "DocLink"("targetDocId");

-- CreateIndex
CREATE INDEX "DocLink_targetBlockId_idx" ON "DocLink"("targetBlockId");

-- AddForeignKey
ALTER TABLE "DocBlock" ADD CONSTRAINT "DocBlock_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocLink" ADD CONSTRAINT "DocLink_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocLink" ADD CONSTRAINT "DocLink_targetDocId_fkey" FOREIGN KEY ("targetDocId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

