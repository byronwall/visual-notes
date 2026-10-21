// Input schemas shared by server actions and MCP tools.
import { z } from "zod";
import { EVENT_DECISIONS, OCCURRENCE_STATUSES, PLACE_KINDS } from "./types";
import { isValidTimeZone } from "./time";

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const localTime = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm");
const timeZone = z.string().refine(isValidTimeZone, "Unknown time zone");
const optionalText = (max: number) => z.string().max(max).nullable().optional();

export const decisionSchema = z.enum(EVENT_DECISIONS);
export const occurrenceStatusSchema = z.enum(OCCURRENCE_STATUSES);
export const placeKindSchema = z.enum(PLACE_KINDS);

/** One show in local terms; omit `time` for an all-day show. */
export const occurrenceInputSchema = z.object({
  date: localDate,
  time: localTime.nullable().optional(),
  endDate: localDate.nullable().optional(),
  endTime: localTime.nullable().optional(),
  timeZone: timeZone.optional(),
  /** False publishes it as an all-day "time TBD" entry. */
  timeConfirmed: z.boolean().optional(),
  label: optionalText(200),
  placeId: z.string().min(1).nullable().optional(),
  ticketStatus: optionalText(200),
  status: occurrenceStatusSchema.optional(),
  decision: decisionSchema.optional(),
  decisionNote: optionalText(4000),
  sourceBlockId: z.string().min(1).nullable().optional(),
});
export type OccurrenceInput = z.infer<typeof occurrenceInputSchema>;

export const occurrencePatchSchema = occurrenceInputSchema.partial();
export type OccurrencePatch = z.infer<typeof occurrencePatchSchema>;

export const eventPatchSchema = z.object({
  url: z.string().max(2000).nullable().optional(),
  summary: optionalText(4000),
  placeId: z.string().min(1).nullable().optional(),
  decision: decisionSchema.optional(),
  decisionNote: optionalText(4000),
});
export type EventPatch = z.infer<typeof eventPatchSchema>;

export const repeatRuleSchema = z.discriminatedUnion("freq", [
  z.object({
    freq: z.literal("daily"),
    interval: z.number().int().min(1).max(30).optional(),
  }),
  z.object({
    freq: z.literal("weekly"),
    interval: z.number().int().min(1).max(12).optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  }),
  z.object({
    freq: z.literal("monthly"),
    interval: z.number().int().min(1).max(12).optional(),
    by: z.enum(["day", "nth-weekday"]).optional(),
  }),
]);

export const repeatInputSchema = z.object({
  /** First show; its date and time anchor the rule. */
  show: occurrenceInputSchema,
  rule: repeatRuleSchema,
  count: z.number().int().min(1).max(104).optional(),
  until: localDate.optional(),
});
export type RepeatOccurrencesInput = z.infer<typeof repeatInputSchema>;

export const placeInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  kind: placeKindSchema.optional(),
  street: optionalText(200),
  city: optionalText(120),
  state: optionalText(60),
  postalCode: optionalText(20),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  url: optionalText(2000),
  notes: optionalText(4000),
  docId: z.string().min(1).nullable().optional(),
});
export type PlaceInput = z.infer<typeof placeInputSchema>;
export const placePatchSchema = placeInputSchema.partial();
export type PlacePatch = z.infer<typeof placePatchSchema>;

export const occurrenceListSchema = z.object({
  /** ISO instant; shows starting before it are left out. */
  from: z.string().optional(),
  to: z.string().optional(),
  docIds: z.array(z.string()).optional(),
  collectionId: z.string().optional(),
  placeId: z.string().optional(),
  /** Matches the effective decision (show's, else event's). */
  decisions: z.array(decisionSchema).optional(),
  includeCancelled: z.boolean().optional(),
  limit: z.number().int().min(1).max(2000).optional(),
});
export type OccurrenceListInput = z.infer<typeof occurrenceListSchema>;
