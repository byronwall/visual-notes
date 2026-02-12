-- CreateEnum
CREATE TYPE "ActionActorType" AS ENUM ('magic_user', 'anonymous', 'system');

-- CreateEnum
CREATE TYPE "ActionActivityClass" AS ENUM ('READ_HEAVY', 'EDIT_HEAVY', 'BALANCED', 'COLD');

-- CreateTable
CREATE TABLE "ActionEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" "ActionActorType" NOT NULL DEFAULT 'anonymous',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "relatedDocId" TEXT,
    "sessionId" TEXT,
    "requestId" TEXT,
    "payload" JSONB,

    CONSTRAINT "ActionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocActivityDaily" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "searchClickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocActivityDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocActivitySnapshot" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "views30d" INTEGER NOT NULL DEFAULT 0,
    "edits30d" INTEGER NOT NULL DEFAULT 0,
    "searchClicks30d" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "lastEditedAt" TIMESTAMP(3),
    "lastInteractedAt" TIMESTAMP(3),
    "activityClass" "ActionActivityClass" NOT NULL DEFAULT 'COLD',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocActivitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionEvent_entityType_entityId_createdAt_idx" ON "ActionEvent"("entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActionEvent_relatedDocId_createdAt_idx" ON "ActionEvent"("relatedDocId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActionEvent_eventType_createdAt_idx" ON "ActionEvent"("eventType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActionEvent_actorId_createdAt_idx" ON "ActionEvent"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DocActivityDaily_date_idx" ON "DocActivityDaily"("date");

-- CreateIndex
CREATE INDEX "DocActivityDaily_docId_date_idx" ON "DocActivityDaily"("docId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DocActivityDaily_docId_date_key" ON "DocActivityDaily"("docId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DocActivitySnapshot_docId_key" ON "DocActivitySnapshot"("docId");

-- CreateIndex
CREATE INDEX "DocActivitySnapshot_lastInteractedAt_idx" ON "DocActivitySnapshot"("lastInteractedAt" DESC);

-- AddForeignKey
ALTER TABLE "ActionEvent" ADD CONSTRAINT "ActionEvent_relatedDocId_fkey" FOREIGN KEY ("relatedDocId") REFERENCES "Doc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocActivityDaily" ADD CONSTRAINT "DocActivityDaily_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocActivitySnapshot" ADD CONSTRAINT "DocActivitySnapshot_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
