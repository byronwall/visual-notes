-- CreateEnum
CREATE TYPE "ReconnectStatus" AS ENUM ('pending', 'snoozed', 'dismissed', 'resolved');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "reconnectEveryDays" INTEGER,
ADD COLUMN     "reconnectSince" DATE;

-- CreateTable
CREATE TABLE "PeopleReconnect" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "suggestedOn" DATE NOT NULL,
    "status" "ReconnectStatus" NOT NULL DEFAULT 'pending',
    "snoozedUntil" DATE,
    "sourceFactId" TEXT,
    "sourceInteractionId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeopleReconnect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PeopleReconnect_key_key" ON "PeopleReconnect"("key");

-- CreateIndex
CREATE INDEX "PeopleReconnect_personId_idx" ON "PeopleReconnect"("personId");

-- CreateIndex
CREATE INDEX "PeopleReconnect_status_suggestedOn_idx" ON "PeopleReconnect"("status", "suggestedOn");

-- AddForeignKey
ALTER TABLE "PeopleReconnect" ADD CONSTRAINT "PeopleReconnect_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
