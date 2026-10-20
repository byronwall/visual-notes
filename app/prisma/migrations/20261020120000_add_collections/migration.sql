-- CreateEnum
CREATE TYPE "CollectionPropertyKind" AS ENUM ('text', 'number', 'select', 'status', 'multi_select', 'date', 'checkbox', 'created_time', 'updated_time');

-- CreateEnum
CREATE TYPE "CollectionViewType" AS ENUM ('table', 'board', 'gallery', 'calendar');

-- AlterTable
ALTER TABLE "Doc" ADD COLUMN     "collectionId" TEXT,
ADD COLUMN     "collectionRank" TEXT,
ADD COLUMN     "properties" JSONB;

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionProperty" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CollectionPropertyKind" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionView" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "hostDocId" TEXT,
    "name" TEXT NOT NULL,
    "type" "CollectionViewType" NOT NULL DEFAULT 'table',
    "config" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Collection_deletedAt_updatedAt_idx" ON "Collection"("deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "CollectionProperty_collectionId_position_idx" ON "CollectionProperty"("collectionId", "position");

-- CreateIndex
CREATE INDEX "CollectionView_collectionId_position_idx" ON "CollectionView"("collectionId", "position");

-- CreateIndex
CREATE INDEX "CollectionView_hostDocId_idx" ON "CollectionView"("hostDocId");

-- CreateIndex
CREATE INDEX "Doc_collectionId_idx" ON "Doc"("collectionId");

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionProperty" ADD CONSTRAINT "CollectionProperty_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionView" ADD CONSTRAINT "CollectionView_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionView" ADD CONSTRAINT "CollectionView_hostDocId_fkey" FOREIGN KEY ("hostDocId") REFERENCES "Doc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
