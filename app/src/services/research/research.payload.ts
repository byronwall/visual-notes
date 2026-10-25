import { z } from "zod";
import {
  RESEARCH_CARD_STATES,
  RESEARCH_CARD_TYPES,
  RESEARCH_LINK_KINDS,
} from "./research.types";

export const MAX_INGEST_CARDS = 500;

/**
 * A reference inside an ingest payload. Either an explicit `ref` declared on a
 * card in the same payload, a positional path (`$0`, `$0.1`, `$2.0.3`), or the
 * id of a card that already exists in the topic.
 */
const refString = z.string().trim().min(1).max(200);

export const GIST_MAX = 600;

/** Field values arrive as text, numbers, or booleans and are stored as text. */
export const fieldsSchema = z
  .record(
    z.string().trim().min(1).max(40),
    z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
  )
  .refine((value) => Object.keys(value).length <= 12, {
    message: "at most 12 fields",
  });

export type IngestCardInput = {
  /** The role; may be left out when `kind` names a declared kind. */
  type?: Exclude<(typeof RESEARCH_CARD_TYPES)[number], "summary">;
  title: string;
  gist?: string;
  body?: string;
  kind?: string;
  fields?: Record<string, string | number | boolean | null>;
  /** Stream key declared on the topic. */
  stream?: string;
  state?: (typeof RESEARCH_CARD_STATES)[number];
  url?: string;
  snippet?: string;
  imageUrl?: string;
  ref?: string;
  children?: IngestCardInput[];
};

const cardTypeWithoutSummary = z.enum(
  RESEARCH_CARD_TYPES.filter((t) => t !== "summary") as [
    NonNullable<IngestCardInput["type"]>,
    ...NonNullable<IngestCardInput["type"]>[],
  ],
  {
    errorMap: () => ({
      message: `type must be one of ${RESEARCH_CARD_TYPES.filter((t) => t !== "summary").join(", ")} (or name a declared kind; put summaries in "summaries")`,
    }),
  },
);

export const ingestCardSchema: z.ZodType<IngestCardInput> = z.lazy(() =>
  z.object({
    type: cardTypeWithoutSummary.optional(),
    title: z.string().trim().min(1).max(300),
    gist: z.string().trim().max(GIST_MAX).optional(),
    body: z.string().max(20_000).optional(),
    kind: z.string().trim().min(1).max(40).optional(),
    fields: fieldsSchema.optional(),
    stream: z.string().trim().min(1).max(40).optional(),
    state: z.enum(RESEARCH_CARD_STATES).optional(),
    url: z.string().trim().max(2_000).optional(),
    snippet: z.string().max(4_000).optional(),
    imageUrl: z.string().trim().max(2_000).optional(),
    ref: refString
      .refine((value) => !value.startsWith("$"), {
        message: "ref must not start with $ (reserved for positional refs)",
      })
      .optional(),
    children: z.array(ingestCardSchema).optional(),
  }),
);

export const ingestLinkSchema = z.object({
  from: refString,
  to: refString,
  kind: z.enum(RESEARCH_LINK_KINDS).optional(),
});

export const ingestSummarySchema = z.object({
  /** Lets a later summary cover this one (nested summary layers). */
  ref: refString
    .refine((value) => !value.startsWith("$"), {
      message: "ref must not start with $ (reserved for positional refs)",
    })
    .optional(),
  title: z.string().trim().min(1).max(300),
  body: z.string().max(20_000).optional(),
  covers: z.array(refString).min(1).max(MAX_INGEST_CARDS),
});

export const ingestPayloadSchema = z.object({
  /** Existing card id the new top-level cards came from. Omit for roots. */
  under: refString.optional(),
  /** Idempotency key: retrying with the same key returns the first result. */
  batchKey: z.string().trim().min(1).max(200),
  /** Who wrote this batch, e.g. "claude-code". */
  agent: z.string().trim().min(1).max(100),
  /** One line describing the batch, shown in topic history. */
  summary: z.string().trim().max(500).optional(),
  cards: z.array(ingestCardSchema).max(MAX_INGEST_CARDS).default([]),
  links: z.array(ingestLinkSchema).max(MAX_INGEST_CARDS).default([]),
  summaries: z.array(ingestSummarySchema).max(100).default([]),
});

export type IngestPayload = z.infer<typeof ingestPayloadSchema>;
export type IngestPayloadInput = z.input<typeof ingestPayloadSchema>;

/** Readable one-line-per-issue rendering of a zod error for agents and logs. */
export const formatPayloadError = (error: z.ZodError): string[] =>
  error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
