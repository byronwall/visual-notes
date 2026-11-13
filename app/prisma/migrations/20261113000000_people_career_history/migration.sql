-- CreateEnum
CREATE TYPE "AffiliationKind" AS ENUM ('employment', 'membership');

-- CreateEnum
CREATE TYPE "AffiliationStatus" AS ENUM ('current', 'ended', 'unknown');

-- AlterTable
ALTER TABLE "PersonAffiliation" ADD COLUMN     "endApprox" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "AffiliationKind" NOT NULL DEFAULT 'employment',
ADD COLUMN     "location" TEXT,
ADD COLUMN     "observedOn" DATE,
ADD COLUMN     "responsibilities" TEXT,
ADD COLUMN     "sourceDocId" TEXT,
ADD COLUMN     "sourceKey" TEXT,
ADD COLUMN     "sourceLabel" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "startApprox" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "AffiliationStatus" NOT NULL DEFAULT 'unknown',
ALTER COLUMN "startOn" SET DATA TYPE TEXT USING to_char("startOn", 'YYYY-MM-DD'),
ALTER COLUMN "endOn" SET DATA TYPE TEXT USING to_char("endOn", 'YYYY-MM-DD');

-- CreateIndex
CREATE UNIQUE INDEX "PersonAffiliation_sourceKey_key" ON "PersonAffiliation"("sourceKey");

-- AddForeignKey
ALTER TABLE "PersonAffiliation" ADD CONSTRAINT "PersonAffiliation_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "Doc"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Legacy rows: a recorded end day means the role ended. A start with no end
-- was entered as a current role. Rows with no dates stay "unknown": an
-- undated export listing is not confirmed current employment.
UPDATE "PersonAffiliation" SET "status" = 'ended' WHERE "endOn" IS NOT NULL;
UPDATE "PersonAffiliation" SET "status" = 'current'
  WHERE "endOn" IS NULL AND "startOn" IS NOT NULL;

-- Schools, churches, teams, and similar groups were memberships, not jobs.
UPDATE "PersonAffiliation" a SET "kind" = 'membership'
  FROM "Organization" o
  WHERE o."id" = a."organizationId"
    AND o."kind" ~* '(school|church|team|club|neighborhood|family|community|congregation)';
