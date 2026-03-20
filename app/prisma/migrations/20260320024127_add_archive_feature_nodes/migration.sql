-- CreateEnum
CREATE TYPE "ArchivedCanvasNodeKind" AS ENUM ('note', 'image');

-- CreateTable
CREATE TABLE "ArchivedCanvasNode" (
    "id" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "kind" "ArchivedCanvasNodeKind" NOT NULL,
    "contentHtml" TEXT,
    "imageUrl" TEXT,
    "canvasX" DOUBLE PRECISION NOT NULL,
    "canvasY" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchivedCanvasNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArchivedCanvasNode_groupName_updatedAt_idx" ON "ArchivedCanvasNode"("groupName", "updatedAt" DESC);
