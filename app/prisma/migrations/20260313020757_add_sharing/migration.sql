-- CreateTable
CREATE TABLE "DocShare" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shareUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocShare_docId_key" ON "DocShare"("docId");

-- CreateIndex
CREATE UNIQUE INDEX "DocShare_slug_key" ON "DocShare"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DocShare_shareUrl_key" ON "DocShare"("shareUrl");

-- CreateIndex
CREATE INDEX "DocShare_slug_idx" ON "DocShare"("slug");

-- AddForeignKey
ALTER TABLE "DocShare" ADD CONSTRAINT "DocShare_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
