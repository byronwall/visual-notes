/*
  Warnings:

  - A unique constraint covering the columns `[originalContentId]` on the table `Doc` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Doc" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "originalContentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Doc_originalContentId_key" ON "Doc"("originalContentId");
