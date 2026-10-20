-- Trigram indexes keep substring searches, including partial words.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AlterTable
ALTER TABLE "Doc" ADD COLUMN     "searchText" TEXT;

-- CreateIndex
CREATE INDEX "Doc_searchText_idx" ON "Doc" USING GIN ("searchText" gin_trgm_ops);

