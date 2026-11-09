-- CreateTable
CREATE TABLE "EditProposal" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "summary" TEXT,
    "ops" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "EditProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EditProposal_docId_resolvedAt_idx" ON "EditProposal"("docId", "resolvedAt");

-- CreateIndex
CREATE INDEX "EditProposal_resolvedAt_createdAt_idx" ON "EditProposal"("resolvedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "EditProposal" ADD CONSTRAINT "EditProposal_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
