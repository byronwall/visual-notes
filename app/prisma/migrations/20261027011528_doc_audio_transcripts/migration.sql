-- CreateEnum
CREATE TYPE "DocAudioTranscriptStatus" AS ENUM ('none', 'pending', 'done', 'failed');

-- AlterTable
ALTER TABLE "Doc" ADD COLUMN     "audioText" TEXT;

-- AlterTable
ALTER TABLE "DocAudio" ADD COLUMN     "transcribedAt" TIMESTAMP(3),
ADD COLUMN     "transcriptAnalysis" JSONB,
ADD COLUMN     "transcriptError" TEXT,
ADD COLUMN     "transcriptModel" TEXT,
ADD COLUMN     "transcriptRaw" TEXT,
ADD COLUMN     "transcriptSegments" JSONB,
ADD COLUMN     "transcriptStatus" "DocAudioTranscriptStatus" NOT NULL DEFAULT 'none';
