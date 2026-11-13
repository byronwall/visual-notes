import { z } from "zod";
import { isRealDay } from "~/lib/people/dates";
import { formatPeriod } from "~/lib/people/career-periods";
import type {
  Affiliation,
  Colleague,
  Fact,
  InteractionView,
  OrganizationSummary,
  PersonMatch,
  PersonProfile,
} from "~/lib/people/types";
import { appLink, type ConnectorContext } from "./shared";

// How People records look to agents: stable ids, appUrl links, and named,
// paged lists. Kept apart from the tool registrations for size.

export const cursorArg = z
  .string()
  .regex(/^\d+$/, "use the nextCursor from the previous page")
  .optional()
  .describe("nextCursor from the previous page");

export const dayFilterArg = z
  .string()
  .refine(isRealDay, "use YYYY-MM-DD")
  .optional();

/** Paging fields: hasMore, and nextCursor when there is a next page. */
export const pageOf = (offset: number, limit: number, hasMore: boolean) => ({
  hasMore,
  ...(hasMore ? { nextCursor: String(offset + limit) } : {}),
});

/** The default source on agent-written facts and encounters. */
export const agentSourceLabel = (ctx: ConnectorContext) =>
  `Agent${ctx.clientName ? `: ${ctx.clientName}` : ""}`;

export const personOut = (ctx: ConnectorContext, p: PersonMatch) => ({
  id: p.id,
  displayName: p.displayName,
  aliases: p.aliases,
  contexts: p.contexts,
  currentRole: p.currentRole,
  location: p.location,
  lastContactOn: p.lastContactOn,
  archived: !!p.archivedAt,
  matchedIn: p.matchedIn,
  appUrl: appLink(ctx, `/people/${p.id}`),
});

export const factOut = (f: Fact) => ({
  id: f.id,
  text: f.text,
  category: f.category,
  learnedOn: f.learnedOn,
  recordedAt: f.createdAt,
  retired: !!f.retiredAt,
  source: {
    label: f.sourceLabel,
    url: f.sourceUrl,
    noteId: f.sourceDocId,
  },
});

export const interactionOut = (ctx: ConnectorContext, i: InteractionView) => ({
  id: i.id,
  occurredOn: i.occurredOn,
  kind: i.kind,
  summary: i.summary,
  archived: !!i.archivedAt,
  participants: i.participants.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    countsAsContact: p.countsAsContact,
    appUrl: appLink(ctx, `/people/${p.id}`),
  })),
  source: { label: i.sourceLabel, url: i.sourceUrl, noteId: i.sourceDocId },
});

export const profileOut = (ctx: ConnectorContext, p: PersonProfile) => ({
  ...personOut(ctx, { ...p, matchedIn: null }),
  summary: p.summary,
  howKnown: p.howKnown,
  customFields: p.customFields,
  contacts: p.contacts,
  affiliations: p.affiliations.map((a) => roleOut(ctx, a)),
  colleagues: p.colleagues.map((c) => colleagueOut(ctx, c)),
  notes: p.notes.map((n) => ({ ...n, appUrl: appLink(ctx, `/docs/${n.id}`) })),
  facts: p.facts.map(factOut),
  interactions: p.interactions.map((i) => interactionOut(ctx, i)),
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

export const organizationOut = (
  ctx: ConnectorContext,
  o: OrganizationSummary,
) => ({
  id: o.id,
  name: o.name,
  kind: o.kind,
  summary: o.summary,
  url: o.url,
  currentMembers: o.currentMembers,
  pastMembers: o.pastMembers,
  unknownMembers: o.unknownMembers,
  icon: o.icon,
  archived: !!o.archivedAt,
  appUrl: appLink(ctx, `/people/organizations/${o.id}`),
});

/** One role with its stated period, status, and source. */
export const roleOut = (ctx: ConnectorContext, a: Affiliation) => ({
  id: a.id,
  organization: {
    ...a.organization,
    appUrl: appLink(ctx, `/people/organizations/${a.organization.id}`),
  },
  kind: a.kind,
  status: a.status,
  role: a.role,
  startOn: a.startOn,
  startApprox: a.startApprox,
  endOn: a.endOn,
  endApprox: a.endApprox,
  /** Readable period, e.g. "Jul 2011 – end unknown"; same text the app shows. */
  period: formatPeriod(a),
  observedOn: a.observedOn,
  responsibilities: a.responsibilities,
  location: a.location,
  source: {
    label: a.sourceLabel,
    url: a.sourceUrl,
    noteId: a.source?.id ?? null,
    key: a.sourceKey,
  },
});

/** A shared employer and how the two periods compare; never a relationship. */
export const colleagueOut = (ctx: ConnectorContext, c: Colleague) => ({
  person: { ...c.person, appUrl: appLink(ctx, `/people/${c.person.id}`) },
  affiliationId: c.affiliationId,
  theirRole: roleOut(ctx, c.other),
  overlap: c.overlap,
});
