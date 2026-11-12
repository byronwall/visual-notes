-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "isSelf" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PersonRelationship" (
    "id" TEXT NOT NULL,
    "fromPersonId" TEXT NOT NULL,
    "toPersonId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT,
    "startOn" DATE,
    "endOn" DATE,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonRelationship_toPersonId_idx" ON "PersonRelationship"("toPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonRelationship_fromPersonId_toPersonId_type_key" ON "PersonRelationship"("fromPersonId", "toPersonId", "type");

-- AddForeignKey
ALTER TABLE "PersonRelationship" ADD CONSTRAINT "PersonRelationship_fromPersonId_fkey" FOREIGN KEY ("fromPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonRelationship" ADD CONSTRAINT "PersonRelationship_toPersonId_fkey" FOREIGN KEY ("toPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
