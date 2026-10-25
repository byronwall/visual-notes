-- AlterTable
ALTER TABLE "NoteAssessment" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decision" TEXT,
ADD COLUMN     "snoozedUntil" TIMESTAMP(3);

