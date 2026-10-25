-- AlterTable
ALTER TABLE "NoteAssessment" ADD COLUMN     "pairsVersion" INTEGER,
ADD COLUMN     "placement" JSONB;

-- CreateTable
CREATE TABLE "NotePairAssessment" (
    "id" TEXT NOT NULL,
    "aId" TEXT NOT NULL,
    "bId" TEXT NOT NULL,
    "aVersion" INTEGER NOT NULL,
    "bVersion" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION,
    "answers" JSONB NOT NULL,
    "relation" TEXT NOT NULL,
    "betterTogether" DOUBLE PRECISION NOT NULL,
    "aCoversB" DOUBLE PRECISION NOT NULL,
    "bCoversA" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotePairAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotePairAssessment_betterTogether_idx" ON "NotePairAssessment"("betterTogether");

-- CreateIndex
CREATE UNIQUE INDEX "NotePairAssessment_aId_bId_key" ON "NotePairAssessment"("aId", "bId");

-- AddForeignKey
ALTER TABLE "NotePairAssessment" ADD CONSTRAINT "NotePairAssessment_aId_fkey" FOREIGN KEY ("aId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotePairAssessment" ADD CONSTRAINT "NotePairAssessment_bId_fkey" FOREIGN KEY ("bId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

