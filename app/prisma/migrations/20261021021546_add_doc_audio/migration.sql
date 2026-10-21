-- CreateEnum
CREATE TYPE "DocAudioStatus" AS ENUM ('recording', 'ready');

-- CreateTable
CREATE TABLE "DocAudio" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "label" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "DocAudioStatus" NOT NULL DEFAULT 'recording',
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocAudio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocAudio_fileName_key" ON "DocAudio"("fileName");

-- CreateIndex
CREATE INDEX "DocAudio_docId_createdAt_idx" ON "DocAudio"("docId", "createdAt");

-- AddForeignKey
ALTER TABLE "DocAudio" ADD CONSTRAINT "DocAudio_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
