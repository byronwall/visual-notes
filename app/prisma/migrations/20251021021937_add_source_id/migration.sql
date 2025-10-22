/*
  Warnings:

  - A unique constraint covering the columns `[originalSource,originalContentId]` on the table `Doc` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Doc_originalContentId_key";

-- AlterTable
ALTER TABLE "Doc" ADD COLUMN     "originalSource" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Doc_originalSource_originalContentId_key" ON "Doc"("originalSource", "originalContentId");
