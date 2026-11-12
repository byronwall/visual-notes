// Input schemas shared by server actions and MCP tools. The store parses
// every write through these, so the UI and agents follow one set of rules.
import { z } from "zod";
import { isRealDay } from "./dates";
import { INTERACTION_KINDS } from "./types";

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
  archived: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});
export type PeopleListInput = z.infer<typeof peopleListSchema>;
