-- CreateEnum
CREATE TYPE "ArchivedPageCaptureMode" AS ENUM ('bulk', 'targeted');

-- CreateTable
CREATE TABLE "ArchivedPage" (
    "id" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "siteHostname" TEXT,
    "groupName" TEXT,
    "lastCapturedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchivedPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivedPageSnapshot" (
    "id" TEXT NOT NULL,
    "archivedPageId" TEXT NOT NULL,
    "captureMode" "ArchivedPageCaptureMode" NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "groupName" TEXT,
    "htmlPath" TEXT,
    "htmlHash" TEXT,
    "meta" JSONB,
    "textSnippet" TEXT,
    "extensionPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivedPageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivedPageNote" (
    "id" TEXT NOT NULL,
    "archivedPageId" TEXT NOT NULL,
    "snapshotId" TEXT,
    "noteText" TEXT NOT NULL,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceContext" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchivedPageNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchivedPage_normalizedUrl_key" ON "ArchivedPage"("normalizedUrl");

-- CreateIndex
CREATE INDEX "ArchivedPage_siteHostname_idx" ON "ArchivedPage"("siteHostname");

-- CreateIndex
CREATE INDEX "ArchivedPage_groupName_idx" ON "ArchivedPage"("groupName");

-- CreateIndex
CREATE INDEX "ArchivedPage_lastCapturedAt_idx" ON "ArchivedPage"("lastCapturedAt" DESC);

-- CreateIndex
CREATE INDEX "ArchivedPageSnapshot_archivedPageId_capturedAt_idx" ON "ArchivedPageSnapshot"("archivedPageId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "ArchivedPageSnapshot_groupName_idx" ON "ArchivedPageSnapshot"("groupName");

-- CreateIndex
CREATE INDEX "ArchivedPageSnapshot_capturedAt_idx" ON "ArchivedPageSnapshot"("capturedAt" DESC);

-- CreateIndex
CREATE INDEX "ArchivedPageSnapshot_htmlHash_idx" ON "ArchivedPageSnapshot"("htmlHash");

-- CreateIndex
CREATE INDEX "ArchivedPageNote_archivedPageId_createdAt_idx" ON "ArchivedPageNote"("archivedPageId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ArchivedPageNote_snapshotId_idx" ON "ArchivedPageNote"("snapshotId");

-- AddForeignKey
ALTER TABLE "ArchivedPageSnapshot" ADD CONSTRAINT "ArchivedPageSnapshot_archivedPageId_fkey" FOREIGN KEY ("archivedPageId") REFERENCES "ArchivedPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivedPageNote" ADD CONSTRAINT "ArchivedPageNote_archivedPageId_fkey" FOREIGN KEY ("archivedPageId") REFERENCES "ArchivedPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivedPageNote" ADD CONSTRAINT "ArchivedPageNote_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ArchivedPageSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
