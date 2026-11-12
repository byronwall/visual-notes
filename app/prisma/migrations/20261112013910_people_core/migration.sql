-- CreateEnum
CREATE TYPE "InteractionKind" AS ENUM ('in_person', 'call', 'video', 'message', 'email', 'event', 'introduction', 'referral', 'recommendation', 'other');

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT,
    "location" TEXT,
    "howKnown" TEXT,
    "contexts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "requestKey" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonFact" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT,
    "learnedOn" DATE,
    "sourceLabel" TEXT,
    "sourceUrl" TEXT,
    "sourceDocId" TEXT,
    "requestKey" TEXT,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "occurredOn" DATE NOT NULL,
    "kind" "InteractionKind" NOT NULL DEFAULT 'in_person',
    "summary" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "sourceUrl" TEXT,
    "sourceDocId" TEXT,
    "requestKey" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionParticipant" (
    "interactionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "countsAsContact" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "InteractionParticipant_pkey" PRIMARY KEY ("interactionId","personId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_requestKey_key" ON "Person"("requestKey");

-- CreateIndex
CREATE INDEX "Person_displayName_idx" ON "Person"("displayName");

-- CreateIndex
CREATE INDEX "Person_archivedAt_idx" ON "Person"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PersonFact_requestKey_key" ON "PersonFact"("requestKey");

-- CreateIndex
CREATE INDEX "PersonFact_personId_idx" ON "PersonFact"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Interaction_requestKey_key" ON "Interaction"("requestKey");

-- CreateIndex
CREATE INDEX "Interaction_occurredOn_idx" ON "Interaction"("occurredOn");

-- CreateIndex
CREATE INDEX "InteractionParticipant_personId_idx" ON "InteractionParticipant"("personId");

-- AddForeignKey
ALTER TABLE "PersonFact" ADD CONSTRAINT "PersonFact_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonFact" ADD CONSTRAINT "PersonFact_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "Doc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "Doc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionParticipant" ADD CONSTRAINT "InteractionParticipant_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "Interaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionParticipant" ADD CONSTRAINT "InteractionParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
