-- CreateTable
CREATE TABLE "Pathway" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "graph" JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
    "context" JSONB,
    "plan" JSONB,
    "sourceTaskId" TEXT,
    "sourceDocId" TEXT,
    "exportListId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pathway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathwayRevision" (
    "id" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PathwayRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathwayTaskLink" (
    "id" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "nodeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "planTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PathwayTaskLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pathway_updatedAt_idx" ON "Pathway"("updatedAt");

-- CreateIndex
CREATE INDEX "Pathway_sourceTaskId_idx" ON "Pathway"("sourceTaskId");

-- CreateIndex
CREATE INDEX "PathwayRevision_pathwayId_createdAt_idx" ON "PathwayRevision"("pathwayId", "createdAt");

-- CreateIndex
CREATE INDEX "PathwayTaskLink_taskId_idx" ON "PathwayTaskLink"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "PathwayTaskLink_pathwayId_taskId_key" ON "PathwayTaskLink"("pathwayId", "taskId");

-- AddForeignKey
ALTER TABLE "Pathway" ADD CONSTRAINT "Pathway_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "TaskItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pathway" ADD CONSTRAINT "Pathway_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "Doc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayRevision" ADD CONSTRAINT "PathwayRevision_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "Pathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayTaskLink" ADD CONSTRAINT "PathwayTaskLink_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "Pathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayTaskLink" ADD CONSTRAINT "PathwayTaskLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TaskItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
