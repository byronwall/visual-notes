// Shared event, show, place, and feed shapes for UI, server, and MCP.
// String unions mirror the Prisma enums so client code never imports Prisma.

export const EVENT_DECISIONS = [
  "unreviewed",
  "interested",
  "tentative",
  "booked",
  "skipped",
  "rejected",
] as const;
export type EventDecision = (typeof EVENT_DECISIONS)[number];

export const OCCURRENCE_STATUSES = [
  "scheduled",
  "cancelled",
  "postponed",
  "sold_out",
] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

export const PLACE_KINDS = ["venue", "restaurant", "shop", "other"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export const DEFAULT_TIME_ZONE = "America/Indiana/Indianapolis";

export const DECISION_LABELS: Record<EventDecision, string> = {
  unreviewed: "Unreviewed",
  interested: "Interested",
  tentative: "Tentative",
  booked: "Booked",
  skipped: "Skipped",
  rejected: "Rejected",
};

export const STATUS_LABELS: Record<OccurrenceStatus, string> = {
  scheduled: "Scheduled",
  cancelled: "Cancelled",
  postponed: "Postponed",
  sold_out: "Sold out",
};

export const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  venue: "Venue",
  restaurant: "Restaurant",
  shop: "Shop",
  other: "Other",
};

export type PlaceSummary = {
  id: string;
  name: string;
  kind: PlaceKind;
  /** One-line address for display and the iCal LOCATION. */
  address: string;
  latitude: number | null;
  longitude: number | null;
};

export type Place = PlaceSummary & {
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  url: string | null;
  notes: string | null;
  docId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Occurrence = {
  id: string;
  eventId: string;
  label: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  timeConfirmed: boolean;
  timeZone: string;
  placeId: string | null;
  place: PlaceSummary | null;
  ticketStatus: string | null;
  status: OccurrenceStatus;
  decision: EventDecision;
  decisionNote: string | null;
  sourceBlockId: string | null;
  sequence: number;
  updatedAt: string;
};

/** The event details stored on one note, with its shows in date order. */
export type NoteEvent = {
  id: string;
  docId: string;
  url: string | null;
  summary: string | null;
  placeId: string | null;
  place: PlaceSummary | null;
  decision: EventDecision;
  decisionNote: string | null;
  occurrences: Occurrence[];
  updatedAt: string;
};

/** One show with enough of its event and note to list it anywhere. */
export type OccurrenceListItem = Occurrence & {
  docId: string;
  title: string;
  collectionId: string | null;
  eventDecision: EventDecision;
  eventUrl: string | null;
  eventSummary: string | null;
  /** The show's own place, falling back to the event's. */
  effectivePlace: PlaceSummary | null;
  /** The show's decision, falling back to the event's. */
  effectiveDecision: EventDecision;
};

export type FeedEntryMode = "include" | "exclude";

export type CalendarFeed = {
  id: string;
  name: string;
  description: string | null;
  token: string;
  collectionId: string | null;
  viewId: string | null;
  decisions: EventDecision[];
  pastDays: number;
  entries: Array<{ eventId: string; mode: FeedEntryMode }>;
  createdAt: string;
  updatedAt: string;
};

/** A show's decision wins unless it was never reviewed. */
export const effectiveDecision = (
  occurrence: EventDecision,
  event: EventDecision,
): EventDecision => (occurrence === "unreviewed" ? event : occurrence);

/** One-line address from its parts, skipping blanks. */
export const formatAddress = (p: {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}) => {
  const region = [p.state, p.postalCode].filter(Boolean).join(" ");
  return [p.street, p.city, region].filter(Boolean).join(", ");
};

/** Lowercased, accent- and punctuation-free name for place dedupe. */
export const normalizePlaceName = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^the /, "")
    .trim();
