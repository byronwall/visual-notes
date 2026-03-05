-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('waiting', 'started', 'deferred', 'complete', 'cancelled');

-- CreateTable
CREATE TABLE "TaskList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'waiting',
    "dueDate" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "meta" JSONB,
    "parentTaskId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskList_sortOrder_idx" ON "TaskList"("sortOrder");

-- CreateIndex
CREATE INDEX "TaskItem_listId_idx" ON "TaskItem"("listId");

-- CreateIndex
CREATE INDEX "TaskItem_parentTaskId_idx" ON "TaskItem"("parentTaskId");

-- CreateIndex
CREATE INDEX "TaskItem_status_idx" ON "TaskItem"("status");

-- CreateIndex
CREATE INDEX "TaskItem_dueDate_idx" ON "TaskItem"("dueDate");

-- CreateIndex
CREATE INDEX "TaskItem_listId_parentTaskId_sortOrder_idx" ON "TaskItem"("listId", "parentTaskId", "sortOrder");

-- AddForeignKey
ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "TaskList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "TaskItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
