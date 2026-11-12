// Shared People types and labels, used by the store, server functions, UI,
// and MCP tools alike.

export const INTERACTION_KINDS = [
  "in_person",
  "call",
  "video",
  "message",
  "email",
  "event",
  "introduction",
  "referral",
  "recommendation",
  "other",
] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number];

export const INTERACTION_KIND_LABELS: Record<InteractionKind, string> = {
  in_person: "In person",
  call: "Call",
  video: "Video call",
  message: "Message",
  email: "Email",
  event: "Event",
  introduction: "Introduction",
  referral: "Referral",
  recommendation: "Recommendation",
  other: "Other",
};

/** Kinds that are usually about someone, not with them. */
export const MENTION_KINDS: ReadonlySet<InteractionKind> = new Set([
  "referral",
  "recommendation",
]);

export type PersonRef = { id: string; displayName: string };

export type PersonSummary = PersonRef & {
  aliases: string[];
  summary: string | null;
  location: string | null;
  contexts: string[];
  /** Latest day of an active encounter where this person was direct contact. */
  lastContactOn: string | null;
  archivedAt: string | null;
};

export type Fact = {
  id: string;
  personId: string;
  text: string;
  category: string | null;
  learnedOn: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  sourceDocId: string | null;
  retiredAt: string | null;
  createdAt: string;
};

export type Participant = PersonRef & { countsAsContact: boolean };

export type InteractionView = {
  id: string;
  occurredOn: string;
  kind: InteractionKind;
  summary: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  sourceDocId: string | null;
  archivedAt: string | null;
  participants: Participant[];
  createdAt: string;
};

export type PersonProfile = PersonSummary & {
  howKnown: string | null;
  customFields: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  facts: Fact[];
  interactions: InteractionView[];
};

/** A search hit and the text that made it match. */
export type PersonMatch = PersonSummary & { matchedIn: string | null };
