// Input schemas shared by server actions and MCP tools. The store parses
// every write through these, so the UI and agents follow one set of rules.
import { z } from "zod";
import { isRealDay } from "./dates";
import { CONTACT_KINDS } from "./contacts";
import { CONTACT_WINDOWS, INTERACTION_KINDS } from "./types";

const day = z
  .string()
  .refine(isRealDay, "Use a real calendar day as YYYY-MM-DD");
const text = (max: number) => z.string().trim().min(1).max(max);
/** Omit to leave a field alone; null or "" clears it. */
const optionalText = (max: number) => z.string().max(max).nullable().optional();
const id = z.string().min(1).max(100);
const requestKey = z.string().trim().min(1).max(200).optional();
const tags = z.array(z.string().trim().min(1).max(80)).max(30);

export const interactionKindSchema = z.enum(INTERACTION_KINDS);

export const sourceSchema = {
  sourceLabel: optionalText(200),
  sourceUrl: optionalText(2000),
  sourceDocId: id.nullable().optional(),
};

const customFields = z
  .record(z.string().trim().min(1).max(80), z.string().max(500))
  .refine((v) => Object.keys(v).length <= 50, "At most 50 custom fields");

export const personInputSchema = z.object({
  displayName: text(200),
  aliases: tags.optional(),
  summary: optionalText(4000),
  location: optionalText(200),
  howKnown: optionalText(1000),
  contexts: tags.optional(),
  customFields: customFields.optional(),
  requestKey,
});
export type PersonInput = z.infer<typeof personInputSchema>;

export const personPatchSchema = personInputSchema
  .omit({ requestKey: true })
  .partial()
  .extend({
    /** true archives, false restores. History is kept either way. */
    archived: z.boolean().optional(),
  });
export type PersonPatch = z.infer<typeof personPatchSchema>;

export const factInputSchema = z.object({
  personId: id,
  text: text(1000),
  category: optionalText(80),
  learnedOn: day.nullable().optional(),
  ...sourceSchema,
  requestKey,
});
export type FactInput = z.infer<typeof factInputSchema>;

export const factPatchSchema = z.object({
  text: text(1000).optional(),
  category: optionalText(80),
  learnedOn: day.nullable().optional(),
  ...sourceSchema,
  /** true retires an obsolete fact; false makes it current again. */
  retired: z.boolean().optional(),
});
export type FactPatch = z.infer<typeof factPatchSchema>;

export const participantSchema = z.object({
  personId: id,
  /** false for someone only discussed, such as a referral's subject. */
  countsAsContact: z.boolean().optional(),
});

export const interactionInputSchema = z.object({
  occurredOn: day,
  kind: interactionKindSchema.optional(),
  summary: text(2000),
  participants: z.array(participantSchema).min(1).max(50),
  ...sourceSchema,
  requestKey,
});
export type InteractionInput = z.infer<typeof interactionInputSchema>;

export const interactionPatchSchema = z.object({
  occurredOn: day.optional(),
  kind: interactionKindSchema.optional(),
  summary: text(2000).optional(),
  /** Replaces the whole participant set. */
  participants: z.array(participantSchema).min(1).max(50).optional(),
  ...sourceSchema,
  archived: z.boolean().optional(),
});
export type InteractionPatch = z.infer<typeof interactionPatchSchema>;

export const peopleListSchema = z.object({
  search: z.string().max(200).optional(),
  context: z.string().max(80).optional(),
  organizationId: id.optional(),
  contact: z.enum(CONTACT_WINDOWS).optional(),
  archived: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});
export type PeopleListInput = z.infer<typeof peopleListSchema>;

export const contactKindSchema = z.enum(CONTACT_KINDS);

export const contactInputSchema = z.object({
  kind: contactKindSchema,
  value: text(500),
  label: optionalText(80),
});
export type ContactInput = z.infer<typeof contactInputSchema>;
export const contactPatchSchema = contactInputSchema.partial();
export type ContactPatch = z.infer<typeof contactPatchSchema>;

export const affiliationInputSchema = z.object({
  organizationId: id,
  role: optionalText(200),
  startOn: day.nullable().optional(),
  /** Set to record that the role ended; null means current. */
  endOn: day.nullable().optional(),
});
export type AffiliationInput = z.infer<typeof affiliationInputSchema>;
export const affiliationPatchSchema = affiliationInputSchema
  .omit({ organizationId: true })
  .partial();
export type AffiliationPatch = z.infer<typeof affiliationPatchSchema>;

export const organizationInputSchema = z.object({
  name: text(200),
  kind: optionalText(80),
  summary: optionalText(4000),
  url: optionalText(2000),
  docId: id.nullable().optional(),
  requestKey,
});
export type OrganizationInput = z.infer<typeof organizationInputSchema>;
export const organizationPatchSchema = organizationInputSchema
  .omit({ requestKey: true })
  .partial()
  .extend({ archived: z.boolean().optional() });
export type OrganizationPatch = z.infer<typeof organizationPatchSchema>;

const nested = <A extends z.ZodTypeAny, U extends z.ZodTypeAny>(
  add: A,
  update: U,
) =>
  z
    .object({
      add: z.array(add).max(50).optional(),
      update: z.array(update).max(50).optional(),
      /** Ids of records to delete; use an end date to record a past role. */
      remove: z.array(id).max(50).optional(),
    })
    .optional();

/** A person patch plus exact nested changes, applied in one transaction. */
export const personUpdateSchema = personPatchSchema.extend({
  /** Merged into custom fields; other keys stay. */
  setCustomFields: z
    .record(z.string().trim().min(1).max(80), z.string().max(500))
    .optional(),
  removeCustomFields: z.array(z.string().max(80)).max(50).optional(),
  contacts: nested(contactInputSchema, contactPatchSchema.extend({ id })),
  affiliations: nested(
    affiliationInputSchema,
    affiliationPatchSchema.extend({ id }),
  ),
  notes: z
    .object({
      link: z.array(id).max(50).optional(),
      unlink: z.array(id).max(50).optional(),
    })
    .optional(),
});
export type PersonUpdate = z.infer<typeof personUpdateSchema>;
