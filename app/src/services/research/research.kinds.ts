import { z } from "zod";
import {
  MAX_KINDS,
  RESEARCH_CARD_TYPES,
  type ResearchKind,
} from "./research.types";

// Topic-declared card kinds. A kind names a thing in the topic's own terms
// ("Carrier", "Printer model") and maps it onto a role the app knows how to
// show; its fields become columns wherever that role is listed.

const keyString = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "use lowercase letters, digits, - or _");

export const kindSchema = z.object({
  key: keyString,
  label: z.string().trim().min(1).max(60),
  role: z.enum(
    RESEARCH_CARD_TYPES.filter((type) => type !== "summary") as [
      ResearchKind["role"],
      ...ResearchKind["role"][],
    ],
  ),
  fields: z
    .array(
      z.object({ key: keyString, label: z.string().trim().min(1).max(60) }),
    )
    .max(8)
    .default([]),
});

export const kindsSchema = z
  .array(kindSchema)
  .max(MAX_KINDS)
  .superRefine((kinds, ctx) => {
    const seen = new Set<string>();
    kinds.forEach((kind, index) => {
      if (seen.has(kind.key))
        ctx.addIssue({
          code: "custom",
          path: [index, "key"],
          message: `duplicate kind "${kind.key}"`,
        });
      seen.add(kind.key);
    });
  });

/** Stored kinds, tolerating anything malformed by dropping it. */
export const parseKinds = (value: unknown): ResearchKind[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = kindSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
};

/** Card field values as text, keeping only string-able entries. */
export const parseFields = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || raw === undefined) continue;
    if (["string", "number", "boolean"].includes(typeof raw))
      out[key] = String(raw);
  }
  return out;
};

/** The label a card shows: its declared kind's label, else the role. */
export const kindLabel = (kinds: ResearchKind[], kind: string | null) =>
  (kind ? kinds.find((entry) => entry.key === kind)?.label : undefined) ?? null;

/**
 * A card's field values in its kind's declared order (Postgres JSONB does not
 * keep key order), then any undeclared keys, labeled for display.
 */
export const orderedFields = (
  kinds: ResearchKind[],
  card: { kind: string | null; fields: Record<string, string> },
): { key: string; label: string; value: string }[] => {
  const declared =
    (card.kind
      ? kinds.find((kind) => kind.key === card.kind)?.fields
      : undefined) ?? [];
  const out = declared
    .filter((field) => card.fields[field.key] !== undefined)
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: card.fields[field.key],
    }));
  const seen = new Set(out.map((field) => field.key));
  for (const [key, value] of Object.entries(card.fields))
    if (!seen.has(key)) out.push({ key, label: key, value });
  return out;
};
