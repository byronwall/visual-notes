-- CreateEnum
CREATE TYPE "EventDecision" AS ENUM ('unreviewed', 'interested', 'tentative', 'booked', 'skipped', 'rejected');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('scheduled', 'cancelled', 'postponed', 'sold_out');

-- CreateEnum
CREATE TYPE "PlaceKind" AS ENUM ('venue', 'restaurant', 'shop', 'other');

-- CreateEnum
CREATE TYPE "FeedEntryMode" AS ENUM ('include', 'exclude');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "url" TEXT,
    "summary" TEXT,
    "placeId" TEXT,
    "decision" "EventDecision" NOT NULL DEFAULT 'unreviewed',
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventOccurrence" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "timeConfirmed" BOOLEAN NOT NULL DEFAULT true,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Indiana/Indianapolis',
    "placeId" TEXT,
    "ticketStatus" TEXT,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'scheduled',
    "decision" "EventDecision" NOT NULL DEFAULT 'unreviewed',
    "decisionNote" TEXT,
    "sourceBlockId" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "kind" "PlaceKind" NOT NULL DEFAULT 'venue',
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "url" TEXT,
    "notes" TEXT,
    "docId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarFeed" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "token" TEXT NOT NULL,
    "collectionId" TEXT,
    "viewId" TEXT,
    "decisions" "EventDecision"[] DEFAULT ARRAY[]::"EventDecision"[],
    "pastDays" INTEGER NOT NULL DEFAULT 90,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarFeedEntry" (
    "feedId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "mode" "FeedEntryMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarFeedEntry_pkey" PRIMARY KEY ("feedId","eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_docId_key" ON "Event"("docId");

-- CreateIndex
CREATE INDEX "Event_placeId_idx" ON "Event"("placeId");

-- CreateIndex
CREATE INDEX "EventOccurrence_startsAt_idx" ON "EventOccurrence"("startsAt");

-- CreateIndex
CREATE INDEX "EventOccurrence_eventId_startsAt_idx" ON "EventOccurrence"("eventId", "startsAt");

-- CreateIndex
CREATE INDEX "EventOccurrence_placeId_idx" ON "EventOccurrence"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "Place_docId_key" ON "Place"("docId");

-- CreateIndex
CREATE INDEX "Place_normalizedName_idx" ON "Place"("normalizedName");

-- CreateIndex
CREATE INDEX "Place_kind_idx" ON "Place"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarFeed_token_key" ON "CalendarFeed"("token");

-- CreateIndex
CREATE INDEX "CalendarFeed_deletedAt_idx" ON "CalendarFeed"("deletedAt");

-- CreateIndex
CREATE INDEX "CalendarFeedEntry_eventId_idx" ON "CalendarFeedEntry"("eventId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOccurrence" ADD CONSTRAINT "EventOccurrence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOccurrence" ADD CONSTRAINT "EventOccurrence_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarFeed" ADD CONSTRAINT "CalendarFeed_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarFeed" ADD CONSTRAINT "CalendarFeed_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "CollectionView"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarFeedEntry" ADD CONSTRAINT "CalendarFeedEntry_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "CalendarFeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarFeedEntry" ADD CONSTRAINT "CalendarFeedEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
