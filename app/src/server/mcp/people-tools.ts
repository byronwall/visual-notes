import { z } from "zod";
import { isRealDay } from "~/lib/people/dates";
import {
  factPatchSchema,
  interactionKindSchema,
  interactionPatchSchema,
  organizationPatchSchema,
  participantSchema,
  personInputSchema,
  personUpdateSchema,
  sourceSchema,
  contactInputSchema,
  affiliationInputSchema,
} from "~/lib/people/schemas";
import { CONTACT_WINDOWS } from "~/lib/people/types";
import {
  addFact,
  logInteraction,
  queryFacts,
  queryInteractions,
  updateFact,
  updateInteraction,
} from "~/server/people/memory-store";
import {
  createOrganization,
  getOrganization,
  listOrganizations,
  updateOrganization,
} from "~/server/people/organization-store";
import {
  createPerson,
  findPeopleByName,
  getPersonProfile,
  listPeople,
  updatePersonProfile,
} from "~/server/people/person-store";
import { listPersonInteractions } from "~/server/people/memory-store";
import { prisma } from "~/server/db";
import { findDuplicates } from "~/server/people/merge-store";
import {
  addFollowup,
  followupDigest,
  listFollowups,
  setReconnectCadence,
  updateFollowup,
} from "~/server/people/reconnect-store";
import {
  agentSourceLabel,
  cursorArg,
  dayFilterArg,
  organizationOut,
  pageOf,
  personOut,
  profileOut,
  interactionOut,
  factOut,
} from "./people-format";
import { ConnectorError, limitArg } from "./shared";
import type { ToolRegistrar } from "./tool-registry";

// People: a private relationship memory. A person is not a note. Facts are
// short sourced assertions about one person; an interaction is one encounter
// shared by its participants. Agents never delete People records, never guess
// identity, and never turn shared membership into acquaintance.

export const PEOPLE_INSTRUCTIONS = [
  'People (people_*) is the user\'s private relationship memory: profiles, remembered facts, shared encounters, and organizations. Find someone with people_search (names, aliases, contacts, facts, encounters, roles) or search with include ["people"] before writing; never write when several people could match — show the candidates and ask.',
  "Record a short detail with people_add_fact and an encounter with people_log_interaction (a day, a kind, one sentence, every participant; countsAsContact: false for someone only discussed). Facts never change last contact. Correct with people_update_fact / people_update_interaction; archive instead of deleting. Pass requestKey on writes so a retry cannot duplicate them.",
  "Only record what the source states. Two people sharing an organization does not mean they know each other. Never send outreach.",
].join("\n");

const personIdArg = z.string().min(1).describe("Person id from people_search");
const requestKeyArg = z
  .string()
  .min(1)
  .max(200)
  .optional()
  .describe(
    "Retry key: repeating a call with the same key returns the first result and writes nothing new",
  );
const dayArg = z.string().refine(isRealDay, "use a real day, YYYY-MM-DD");
const sourceArgs = {
  sourceLabel: sourceSchema.sourceLabel.describe(
    "Where this came from; defaults to this agent",
  ),
  sourceUrl: sourceSchema.sourceUrl,
  sourceNoteId: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe("Note this came from"),
};
/** Maps the agent-facing sourceNoteId onto the store's sourceDocId. */
const withNote = <T extends { sourceNoteId?: string | null }>({
  sourceNoteId,
  ...rest
}: T) => ({
  ...rest,
  ...(sourceNoteId === undefined ? {} : { sourceDocId: sourceNoteId }),
});

export function registerPeopleTools(tools: ToolRegistrar): void {
  const { ctx } = tools;
  const source = (label?: string | null) => label ?? agentSourceLabel(ctx);
  const personRefOut = (p: { id: string; displayName: string }) => ({
    id: p.id,
    displayName: p.displayName,
    appUrl: `${ctx.origin}/people/${p.id}`,
  });

  tools.read(
    "people_search",
    {
      title: "Search people",
      description:
        "Find people without knowing an id: matches names, aliases, contact values (phones by digits), remembered facts, encounter text, roles, and organization names, and says what matched (matchedIn). Filter by context, organizationId, last-contact window, or archived. Name matches come first. Use people_get for the full record.",
      input: {
        query: z.string().max(200).optional(),
        context: z
          .string()
          .max(80)
          .optional()
          .describe("A life context such as work, school, church"),
        organizationId: z.string().optional(),
        contact: z
          .enum(CONTACT_WINDOWS)
          .optional()
          .describe(
            "Last recorded contact: 30, 90, 365 days; over365; none (no recorded contact)",
          ),
        archived: z
          .boolean()
          .optional()
          .describe("true lists only archived people"),
        limit: limitArg(100, 25),
        cursor: cursorArg,
      },
    },
    async ({ query, cursor, limit = 25, ...filters }) => {
      const offset = Number(cursor ?? 0);
      const r = await listPeople({ search: query, limit, offset, ...filters });
      return {
        people: r.people.map((p) => personOut(ctx, p)),
        total: r.total,
        ...pageOf(offset, limit, r.hasMore),
      };
    },
  );

  tools.read(
    "people_get",
    {
      title: "Get person",
      description:
        "One person's profile: summary, contexts, aliases, contact methods, roles at organizations, custom fields, linked notes, every remembered fact (current and retired), and a page of encounters newest first. Nested records carry ids for people_update. Page history with historyCursor.",
      input: {
        id: personIdArg,
        historyLimit: limitArg(100, 20),
        historyCursor: cursorArg,
      },
    },
    async ({ id, historyLimit = 20, historyCursor }) => {
      const profile = await getPersonProfile(id, { interactionLimit: 1 });
      if (!profile) throw new ConnectorError("not_found", `No person ${id}`);
      const offset = Number(historyCursor ?? 0);
      const page = await listPersonInteractions(id, {
        limit: historyLimit,
        offset,
      });
      return {
        person: profileOut(ctx, {
          ...profile,
          interactions: page.interactions,
        }),
        history: pageOf(offset, historyLimit, page.hasMore),
      };
    },
  );

  tools.read(
    "people_query_facts",
    {
      title: "Query remembered facts",
      description:
        "Remembered facts across people, newest first, with the person and source. Defaults to current facts; state retired or all includes obsolete ones.",
      input: {
        personId: z.string().optional(),
        text: z.string().max(200).optional(),
        category: z.string().max(80).optional(),
        state: z.enum(["current", "retired", "all"]).optional(),
        learnedFrom: dayFilterArg,
        learnedTo: dayFilterArg,
        limit: limitArg(100, 25),
        cursor: cursorArg,
      },
    },
    async ({ cursor, limit = 25, ...q }) => {
      const offset = Number(cursor ?? 0);
      const r = await queryFacts({ ...q, limit, offset });
      return {
        facts: r.facts.map((f) => ({
          ...factOut(f),
          person: personRefOut(f.person),
        })),
        ...pageOf(offset, limit, r.hasMore),
      };
    },
  );

  tools.read(
    "people_query_interactions",
    {
      title: "Query encounters",
      description:
        "Encounters across people, newest day first, with participants (countsAsContact false = only discussed). Filter by person, text, kind, and day range; archived ones only with includeArchived.",
      input: {
        personId: z.string().optional(),
        text: z.string().max(200).optional(),
        kind: interactionKindSchema.optional(),
        from: dayFilterArg,
        to: dayFilterArg,
        includeArchived: z.boolean().optional(),
        limit: limitArg(100, 25),
        cursor: cursorArg,
      },
    },
    async ({ cursor, limit = 25, ...q }) => {
      const offset = Number(cursor ?? 0);
      const r = await queryInteractions({ ...q, limit, offset });
      return {
        interactions: r.interactions.map((i) => interactionOut(ctx, i)),
        ...pageOf(offset, limit, r.hasMore),
      };
    },
  );

  tools.read(
    "people_query_organizations",
    {
      title: "Query organizations",
      description:
        "Companies, schools, churches, and other groups with current and past member counts.",
      input: {
        search: z.string().max(200).optional().describe("Text in the name"),
        archived: z.boolean().optional(),
        limit: limitArg(200, 50),
      },
    },
    async ({ limit = 50, ...q }) => ({
      organizations: (await listOrganizations({ ...q, limit })).map((o) =>
        organizationOut(ctx, o),
      ),
    }),
  );

  tools.read(
    "people_get_organization",
    {
      title: "Get organization",
      description:
        "One organization: details, linked note, and every member with role, dates, and affiliationId. Shared membership is context, not evidence that members know each other.",
      input: { id: z.string().min(1) },
    },
    async ({ id }) => {
      const org = await getOrganization(id);
      if (!org) throw new ConnectorError("not_found", `No organization ${id}`);
      return {
        organization: {
          ...organizationOut(ctx, org),
          note: org.note
            ? { ...org.note, appUrl: `${ctx.origin}/docs/${org.note.id}` }
            : null,
          members: org.members.map((m) => ({
            ...m,
            appUrl: `${ctx.origin}/people/${m.id}`,
          })),
        },
      };
    },
  );

  tools.read(
    "people_find_duplicates",
    {
      title: "Find possible duplicates",
      description:
        "People who might be the same as this one, with evidence (same name, name matches an alias, same email/phone/url). Evidence is a hint, not proof: families share phones and names repeat. Merging stays with the user in the app.",
      input: { personId: personIdArg },
    },
    async ({ personId }) => ({
      candidates: (await findDuplicates(personId)).map((d) => ({
        ...d,
        appUrl: `${ctx.origin}/people/${d.id}`,
      })),
    }),
  );

  tools.read(
    "people_list_followups",
    {
      title: "List reasons to reconnect",
      description:
        "The reconnect queue: due suggestions from people the user opted in (a cadence after last contact) and explicit reasons, each with its source and a stable key. upcomingDays adds what is coming up; include picks states. digest is the same list as plain text with links. No recorded contact is unknown history, not overdue.",
      input: {
        upcomingDays: z.number().int().min(0).max(365).optional(),
        include: z
          .array(z.enum(["pending", "snoozed", "dismissed", "resolved"]))
          .optional(),
        personId: z.string().optional(),
      },
    },
    async (args) => {
      const items = await listFollowups(args);
      return {
        followups: items.map((i) => ({
          ...i,
          person: {
            ...i.person,
            appUrl: `${ctx.origin}/people/${i.person.id}`,
          },
        })),
        digest: followupDigest(items, ctx.origin),
      };
    },
  );

  tools.write(
    "people_add_followup",
    {
      title: "Add a reason to reconnect",
      description:
        'Create an explicit reconnect prompt for one person, such as "Ask how the new job is going", optionally tied to the fact or encounter it came from. Never send a message yourself.',
      input: {
        personId: personIdArg,
        reason: z.string().min(1).max(500),
        suggestedOn: dayArg
          .optional()
          .describe("The day to surface it; defaults to today"),
        sourceFactId: z.string().optional(),
        sourceInteractionId: z.string().optional(),
        requestKey: requestKeyArg,
      },
    },
    async (args) => {
      const r = await addFollowup(args);
      return { created: !r.existing, id: r.id, key: r.key };
    },
  );

  tools.write(
    "people_update_followup",
    {
      title: "Update a reason to reconnect",
      description:
        "Act on one queue item by its key: snooze (with snoozedUntil), dismiss (never show this one again), resolve (done), or reopen. None of these count as contact; log an encounter for that.",
      input: {
        key: z.string().min(1),
        action: z.enum(["snooze", "dismiss", "resolve", "reopen"]),
        snoozedUntil: dayArg.optional(),
        reason: z
          .string()
          .max(500)
          .optional()
          .describe("Correct a prompt's text"),
        suggestedOn: dayArg.optional(),
      },
    },
    async (args) => updateFollowup(args),
  );

  tools.write(
    "people_create",
    {
      title: "Create person",
      description:
        "Create a profile, optionally with contacts, roles (organizationId from people_query_organizations or people_create_organization), and linked noteIds. Refuses when people with the same name exist and returns them; pass allowDuplicate only when the user confirmed this is a different person.",
      input: {
        ...personInputSchema.omit({ requestKey: true }).shape,
        contacts: z.array(contactInputSchema).max(20).optional(),
        affiliations: z.array(affiliationInputSchema).max(20).optional(),
        noteIds: z.array(z.string().min(1)).max(20).optional(),
        allowDuplicate: z.boolean().optional(),
        requestKey: requestKeyArg,
      },
    },
    async ({
      contacts,
      affiliations,
      noteIds,
      allowDuplicate,
      requestKey,
      ...input
    }) => {
      if (
        !allowDuplicate &&
        !(
          requestKey &&
          (await prisma.person.findUnique({ where: { requestKey } }))
        )
      ) {
        const same = (await findPeopleByName(input.displayName, 10)).filter(
          (p) =>
            p.displayName.toLowerCase() ===
            input.displayName.trim().toLowerCase(),
        );
        if (same.length) {
          return {
            created: false,
            reason:
              "People with this name exist. Confirm identity with the user, then update one or pass allowDuplicate.",
            candidates: same.map((p) =>
              personOut(ctx, { ...p, matchedIn: null }),
            ),
          };
        }
      }
      // One transaction: a bad organization or note id leaves no person
      // behind, so a retry with the same requestKey starts clean.
      const { person, existing } = await createPerson(
        { ...input, requestKey },
        { contacts, affiliations, noteIds },
      );
      return {
        created: !existing,
        id: person.id,
        summary: existing
          ? "Returned the person created earlier with this requestKey."
          : `Created ${person.displayName}.`,
        appUrl: `${ctx.origin}/people/${person.id}`,
      };
    },
  );

  tools.write(
    "people_update",
    {
      title: "Update person",
      description:
        'Patch a profile. Omitted fields stay; null or "" clears a text field. customFields replaces all custom fields; setCustomFields / removeCustomFields merge. contacts and affiliations take {add, update:[{id,...}], remove:[id]} using ids from people_get; to record that a role ended, update its endOn instead of removing it. notes takes {link, unlink} note ids. archived true/false archives or restores; history is kept. All changes apply together or not at all.',
      input: {
        id: personIdArg,
        ...personUpdateSchema.shape,
        reconnectEveryDays: z
          .number()
          .int()
          .min(7)
          .max(3650)
          .nullable()
          .optional()
          .describe(
            "Opt in to reconnect suggestions this many days after last contact; null turns them off",
          ),
      },
    },
    async ({ id, reconnectEveryDays, ...input }) => {
      // The cadence commits with the rest of the update, or not at all.
      const { person, changed } = await updatePersonProfile(
        id,
        input,
        reconnectEveryDays === undefined
          ? undefined
          : (tx) => setReconnectCadence(id, reconnectEveryDays, undefined, tx),
      );
      if (reconnectEveryDays !== undefined) changed.push("reconnectEveryDays");
      return {
        id: person.id,
        changed,
        summary: changed.length
          ? `Updated ${changed.join(", ")}.`
          : "Nothing to change.",
        appUrl: `${ctx.origin}/people/${person.id}`,
      };
    },
  );

  tools.write(
    "people_add_fact",
    {
      title: "Remember a fact",
      description:
        'Append one short, sourced detail to a person ("Oldest child enjoys robotics"). It never changes last contact. learnedOn is the day it was learned, when known. Defaults the source to this agent.',
      input: {
        personId: personIdArg,
        text: z.string().min(1).max(1000),
        category: z.string().max(80).optional(),
        learnedOn: dayArg.optional(),
        ...sourceArgs,
        requestKey: requestKeyArg,
      },
    },
    async ({ sourceLabel, ...input }) => {
      const { fact, existing } = await addFact({
        ...withNote(input),
        sourceLabel: source(sourceLabel),
      });
      return {
        created: !existing,
        id: fact.id,
        fact: factOut(fact),
        appUrl: `${ctx.origin}/people/${fact.personId}`,
      };
    },
  );

  tools.write(
    "people_update_fact",
    {
      title: "Correct a fact",
      description:
        "Correct one fact's text, category, learnedOn, or source, or set retired true to move an obsolete fact to history (false restores it). Other facts are untouched.",
      input: {
        id: z.string().min(1),
        ...factPatchSchema.omit({ sourceDocId: true }).shape,
        sourceNoteId: sourceArgs.sourceNoteId,
      },
    },
    async ({ id, ...patch }) => {
      const fact = await updateFact(id, withNote(patch));
      return {
        id,
        fact: factOut(fact),
        appUrl: `${ctx.origin}/people/${fact.personId}`,
      };
    },
  );

  tools.write(
    "people_log_interaction",
    {
      title: "Log an encounter",
      description:
        "Record one real encounter shared by every participant: occurredOn (YYYY-MM-DD, not in the future), kind, and a one-sentence summary. Set countsAsContact: false for anyone only discussed (a referral's subject); only contact participants update last contact. Defaults the source to this agent.",
      input: {
        occurredOn: dayArg,
        kind: interactionKindSchema.optional(),
        summary: z.string().min(1).max(2000),
        participants: z.array(participantSchema).min(1).max(50),
        ...sourceArgs,
        requestKey: requestKeyArg,
      },
    },
    async ({ sourceLabel, ...input }) => {
      const { interaction, existing } = await logInteraction({
        ...withNote(input),
        sourceLabel: source(sourceLabel),
      });
      return {
        created: !existing,
        id: interaction.id,
        interaction: interactionOut(ctx, interaction),
      };
    },
  );

  tools.write(
    "people_update_interaction",
    {
      title: "Correct an encounter",
      description:
        "Correct one encounter's day, kind, summary, source, or whole participant list, or set archived true to hide it (false restores). Last contact is recomputed from what remains.",
      input: {
        id: z.string().min(1),
        ...interactionPatchSchema.omit({ sourceDocId: true }).shape,
        sourceNoteId: sourceArgs.sourceNoteId,
      },
    },
    async ({ id, ...patch }) => ({
      id,
      interaction: interactionOut(
        ctx,
        await updateInteraction(id, withNote(patch)),
      ),
    }),
  );

  tools.write(
    "people_create_organization",
    {
      title: "Create organization",
      description:
        "Create a company, school, church, team, or other group. Refuses when organizations with the same name exist and returns them; pass allowDuplicate only for a truly different one.",
      input: {
        name: z.string().min(1).max(200),
        kind: z.string().max(80).optional(),
        summary: z.string().max(4000).optional(),
        url: z.string().max(2000).optional(),
        noteId: z.string().optional().describe("A note about the organization"),
        allowDuplicate: z.boolean().optional(),
        requestKey: requestKeyArg,
      },
    },
    async ({ noteId, allowDuplicate, ...input }) => {
      if (!allowDuplicate) {
        const same = (await listOrganizations({ search: input.name })).filter(
          (o) => o.name.toLowerCase() === input.name.trim().toLowerCase(),
        );
        const keyed = input.requestKey
          ? await prisma.organization.findUnique({
              where: { requestKey: input.requestKey },
            })
          : null;
        if (same.length && !keyed) {
          return {
            created: false,
            reason:
              "Organizations with this name exist. Use one of them, or pass allowDuplicate.",
            candidates: same.map((o) => organizationOut(ctx, o)),
          };
        }
      }
      const { organization, existing } = await createOrganization({
        ...input,
        docId: noteId,
      });
      return {
        created: !existing,
        id: organization.id,
        organization: organizationOut(ctx, organization),
      };
    },
  );

  tools.write(
    "people_update_organization",
    {
      title: "Update organization",
      description:
        "Patch an organization's name, kind, summary, url, or linked note (noteId; null unlinks). archived true/false archives or restores it. People's roles are changed with people_update.",
      input: {
        id: z.string().min(1),
        ...organizationPatchSchema.omit({ docId: true }).shape,
        noteId: z.string().nullable().optional(),
      },
    },
    async ({ id, noteId, ...patch }) => {
      const { organization, changed } = await updateOrganization(id, {
        ...patch,
        docId: noteId,
      });
      return { id, changed, organization: organizationOut(ctx, organization) };
    },
  );
}
