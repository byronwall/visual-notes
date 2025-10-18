-- CreateTable
CREATE TABLE "EmbeddingRun" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dims" INTEGER NOT NULL,
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocEmbedding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "vector" DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UmapRun" (
    "id" TEXT NOT NULL,
    "embeddingRunId" TEXT NOT NULL,
    "dims" INTEGER NOT NULL,
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UmapRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UmapPoint" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "z" DOUBLE PRECISION,

    CONSTRAINT "UmapPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocEmbedding_docId_idx" ON "DocEmbedding"("docId");

-- CreateIndex
CREATE UNIQUE INDEX "DocEmbedding_runId_docId_key" ON "DocEmbedding"("runId", "docId");

-- CreateIndex
CREATE INDEX "UmapRun_embeddingRunId_createdAt_idx" ON "UmapRun"("embeddingRunId", "createdAt");

-- CreateIndex
CREATE INDEX "UmapPoint_docId_idx" ON "UmapPoint"("docId");

-- CreateIndex
CREATE UNIQUE INDEX "UmapPoint_runId_docId_key" ON "UmapPoint"("runId", "docId");

-- AddForeignKey
ALTER TABLE "DocEmbedding" ADD CONSTRAINT "DocEmbedding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EmbeddingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmapRun" ADD CONSTRAINT "UmapRun_embeddingRunId_fkey" FOREIGN KEY ("embeddingRunId") REFERENCES "EmbeddingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmapPoint" ADD CONSTRAINT "UmapPoint_runId_fkey" FOREIGN KEY ("runId") REFERENCES "UmapRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
