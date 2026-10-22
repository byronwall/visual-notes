import { z } from "zod";
import { prisma } from "~/server/db";

// What every connector tool family shares: the caller, refusals, how a note
// is summarized, links into the app, and the common argument shapes.
//
// Conventions agents rely on:
// - `appUrl` always opens the record in Visual Notes; `url` is always a web
//   address (a source, an event's ticket page, an archived page).
// - A tool's own records are `id` / `ids`; records of other areas are
//   `noteId`, `listId`, `showId`, and so on.
// - Lists come back under a named key (`{ notes: [...] }`), never bare.

/** `Doc.originalSource` for notes created through the connector. */
export const CHATGPT_SOURCE = "chatgpt";

export type ConnectorContext = {
  /** Public origin used to build app links, e.g. https://notes.example.com */
  origin: string;
  /** Who is calling; recorded on activity events. */
  actorId: string;
  /** OAuth scopes granted to the caller, e.g. notes:read notes:write. */
  scopes: string[];
  /** WWW-Authenticate challenge returned when a tool needs more scope. */
  scopeChallenge: string;
  /** The OAuth client's registered name ("Claude", "ChatGPT"), when known. */
  clientName?: string | null;
};

export type ConnectorErrorCode =
  | "not_found"
  | "not_owner"
  | "invalid"
  | "duplicate";

export class ConnectorError extends Error {
  constructor(
    readonly code: ConnectorErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}

/** The one wording for a refused batch: nothing was written, here is why. */
export function nothingWritten(problems: string[]): string {
  return `Nothing was written. Fix these and retry:\n${problems.map((p) => `- ${p}`).join("\n")}`;
}

/** The activity-event context for a connector write. */
export const agentContext = (ctx: ConnectorContext) => ({
  actorId: ctx.actorId,
  actorType: "chatgpt" as const,
});

export const appLink = (ctx: ConnectorContext, path: string) =>
  `${ctx.origin}${path}`;

export const noteAppUrl = (ctx: ConnectorContext, id: string) =>
  appLink(ctx, `/docs/${id}`);

/** Who wrote a note, as agents see it. */
export type CreatedBy = "agent" | "user";

export type NoteSummary = {
  id: string;
  title: string;
  path: string | null;
  appUrl: string;
  createdBy: CreatedBy;
  updatedAt: string;
};

type SummaryRow = {
  id: string;
  title: string;
  path: string | null;
  originalSource: string | null;
  updatedAt: Date;
};

export const summarySelect = {
  id: true,
  title: true,
  path: true,
  originalSource: true,
  updatedAt: true,
} as const;

export function isAgentNote(doc: { originalSource: string | null }): boolean {
  return doc.originalSource === CHATGPT_SOURCE;
}

export function toSummary(ctx: ConnectorContext, doc: SummaryRow): NoteSummary {
  return {
    id: doc.id,
    title: doc.title,
    path: doc.path,
    appUrl: noteAppUrl(ctx, doc.id),
    createdBy: isAgentNote(doc) ? "agent" : "user",
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** A linked note as other records show it. */
export const noteRef = (
  ctx: ConnectorContext,
  id: string | null | undefined,
  title: string | null | undefined,
) => (id ? { id, title: title ?? null, appUrl: noteAppUrl(ctx, id) } : null);

/** Refuses when any of these note ids does not exist. */
export async function requireNotes(
  ids: (string | null | undefined)[],
): Promise<void> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!wanted.length) return;
  const found = await prisma.doc.findMany({
    where: { id: { in: wanted } },
    select: { id: true },
  });
  const known = new Set(found.map((doc) => doc.id));
  const missing = wanted.filter((id) => !known.has(id));
  if (missing.length) {
    throw new ConnectorError(
      "not_found",
      `Nothing was written. No notes with ids: ${missing.join(", ")}`,
    );
  }
}

/** Parses an optional ISO date or date-time argument, refusing junk. */
export function parseSince(
  value: string | undefined,
  label: string,
): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ConnectorError("invalid", `${label} is not a date: ${value}`);
  }
  return date;
}

export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar day, YYYY-MM-DD. */
export const dayArg = z.string().regex(DAY_PATTERN, "use YYYY-MM-DD");

export const noteIdArg = z.string().min(1).describe("Note id");

export const limitArg = (max: number, fallback: number) =>
  z
    .number()
    .int()
    .min(1)
    .max(max)
    .optional()
    .describe(`At most ${max}; defaults to ${fallback}`);

/**
 * A record named by id or by exact name (case-insensitive). Several records
 * with that name is a refusal that lists their ids.
 */
export async function resolveByIdOrName<T extends { id: string }>(
  ref: string,
  lookup: {
    kind: string;
    byId: (id: string) => Promise<T | null>;
    byName: (name: string) => Promise<T[]>;
    /** The tool that lists the choices, named in the refusal. */
    listTool: string;
  },
): Promise<T> {
  const value = ref.trim();
  const byId = await lookup.byId(value);
  if (byId) return byId;
  const matches = await lookup.byName(value);
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new ConnectorError(
      "invalid",
      `Several ${lookup.kind}s are named "${value}"; pass one id: ${matches.map((m) => m.id).join(", ")}`,
    );
  }
  throw new ConnectorError(
    "not_found",
    `No ${lookup.kind} "${value}". Use ${lookup.listTool}.`,
  );
}
