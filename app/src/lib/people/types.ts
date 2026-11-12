import type { ContactKind } from "./contacts";

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
  /** First current affiliation, e.g. "Engineer, Acme". */
  currentRole: string | null;
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

export type Contact = {
  id: string;
  kind: ContactKind;
  label: string | null;
  value: string;
};

export type Affiliation = {
  id: string;
  organization: { id: string; name: string; kind: string | null };
  role: string | null;
  startOn: string | null;
  endOn: string | null;
};

export type LinkedNote = { id: string; title: string; path: string | null };

export type PersonProfile = PersonSummary & {
  howKnown: string | null;
  customFields: Record<string, string>;
  /** Set when this profile was merged into another one. */
  mergedInto: PersonRef | null;
  /** Opt-in reconnect cadence in days, or null when off. */
  reconnectEveryDays: number | null;
  contacts: Contact[];
  affiliations: Affiliation[];
  notes: LinkedNote[];
  createdAt: string;
  updatedAt: string;
  facts: Fact[];
  interactions: InteractionView[];
};

/** A search hit and the text that made it match. */
export type PersonMatch = PersonSummary & { matchedIn: string | null };

export type OrganizationSummary = {
  id: string;
  name: string;
  kind: string | null;
  summary: string | null;
  url: string | null;
  currentMembers: number;
  pastMembers: number;
  archivedAt: string | null;
};

export type OrganizationMember = PersonRef & {
  affiliationId: string;
  role: string | null;
  startOn: string | null;
  endOn: string | null;
  archived: boolean;
};

export type OrganizationDetail = OrganizationSummary & {
  note: LinkedNote | null;
  members: OrganizationMember[];
};

/** Directory filter on last recorded contact. */
export const CONTACT_WINDOWS = ["30", "90", "365", "over365", "none"] as const;
export type ContactWindow = (typeof CONTACT_WINDOWS)[number];
export const CONTACT_WINDOW_LABELS: Record<ContactWindow, string> = {
  "30": "Contact in last 30 days",
  "90": "Contact in last 90 days",
  "365": "Contact in last year",
  over365: "No contact in over a year",
  none: "No recorded contact",
};
