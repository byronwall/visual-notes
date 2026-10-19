/** `Doc.originalSource` for notes created through the connector. */
export const CHATGPT_SOURCE = "chatgpt";

export type ConnectorContext = {
  /** Public origin used to build note links, e.g. https://notes.example.com */
  origin: string;
  /** Who is calling; recorded on activity events. */
  actorId: string;
};

export type ConnectorErrorCode = "not_found" | "not_owner" | "invalid";

export class ConnectorError extends Error {
  constructor(
    readonly code: ConnectorErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}

export type NoteSummary = {
  id: string;
  title: string;
  path: string | null;
  url: string;
  createdBy: "chatgpt" | "user";
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

export function noteUrl(ctx: ConnectorContext, id: string): string {
  return `${ctx.origin}/docs/${id}`;
}

export function isChatGptNote(doc: { originalSource: string | null }): boolean {
  return doc.originalSource === CHATGPT_SOURCE;
}

export function toSummary(ctx: ConnectorContext, doc: SummaryRow): NoteSummary {
  return {
    id: doc.id,
    title: doc.title,
    path: doc.path,
    url: noteUrl(ctx, doc.id),
    createdBy: isChatGptNote(doc) ? "chatgpt" : "user",
    updatedAt: doc.updatedAt.toISOString(),
  };
}
