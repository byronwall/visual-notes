-- CreateTable
CREATE TABLE "TimeBlock" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "color" TEXT,
    "isFixedTime" BOOLEAN NOT NULL DEFAULT false,
    "comments" TEXT,
    "noteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeBlockDayMetadata" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "contributor" TEXT NOT NULL DEFAULT 'default',
    "comments" TEXT,
    "noteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeBlockDayMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeBlock_startTime_idx" ON "TimeBlock"("startTime");

-- CreateIndex
CREATE INDEX "TimeBlock_noteId_idx" ON "TimeBlock"("noteId");

-- CreateIndex
CREATE INDEX "TimeBlockDayMetadata_date_idx" ON "TimeBlockDayMetadata"("date");

-- CreateIndex
CREATE INDEX "TimeBlockDayMetadata_key_idx" ON "TimeBlockDayMetadata"("key");

-- CreateIndex
CREATE INDEX "TimeBlockDayMetadata_noteId_idx" ON "TimeBlockDayMetadata"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeBlockDayMetadata_date_key_contributor_key" ON "TimeBlockDayMetadata"("date", "key", "contributor");

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Doc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlockDayMetadata" ADD CONSTRAINT "TimeBlockDayMetadata_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Doc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
