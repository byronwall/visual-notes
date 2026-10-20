import { createHash, randomUUID } from "crypto";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import {
  appendMarkdown,
  contentFromMarkdown,
  type NoteContent,
} from "./note-content";
import {
  CHATGPT_SOURCE,
  ConnectorError,
  isChatGptNote,
  noteUrl,
  type ConnectorContext,
} from "./notes-shared";
import { normalizeNotePath } from "./paths";
import { scheduleEmbeddingRefresh } from "./semantic";

export type WriteResult = {
  id: string;
  title: string;
  path: string | null;
  url: string;
  version: number;
};

export type CreateResult = WriteResult & {
  pathIsNew: boolean;
  deduplicated: boolean;
};

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function eventContext(ctx: ConnectorContext) {
  return { actorId: ctx.actorId, actorType: "chatgpt" as const };
}

async function countVersions(docId: string): Promise<number> {
  return (await prisma.docRevision.count({ where: { docId } })) + 1;
}

async function isExistingPath(path: string): Promise<boolean> {
  const match = await prisma.doc.findFirst({
    where: { OR: [{ path }, { path: { startsWith: `${path}.` } }] },
    select: { id: true },
  });
  return Boolean(match);
}

export async function createNote(
  ctx: ConnectorContext,
  input: {
    title: string;
    path?: string;
    markdown: string;
    idempotencyKey?: string;
  },
): Promise<CreateResult> {
  const title = input.title.trim();
  if (!title) throw new ConnectorError("invalid", "title is required");
  if (!input.markdown.trim())
    throw new ConnectorError("invalid", "markdown is required");
  const path = normalizeNotePath(input.path);
  const key = input.idempotencyKey?.trim() || randomUUID();

  const existing = await prisma.doc.findUnique({
    where: {
      originalSource_originalContentId: {
        originalSource: CHATGPT_SOURCE,
        originalContentId: key,
      },
    },
    select: { id: true, title: true, path: true },
  });
  if (existing) {
    return {
      ...existing,
      url: noteUrl(ctx, existing.id),
      version: await countVersions(existing.id),
      pathIsNew: false,
      deduplicated: true,
    };
  }

  const pathIsNew = path ? !(await isExistingPath(path)) : false;
  const content = contentFromMarkdown(input.markdown);
  const created = await prisma.doc.create({
    data: {
      title,
      path,
      ...content,
      originalSource: CHATGPT_SOURCE,
      originalContentId: key,
      contentHash: sha256(content.markdown),
    },
    select: { id: true, title: true, path: true },
  });
  await logActionEvent({
    eventType: "doc.create",
    entityType: "doc",
    entityId: created.id,
    relatedDocId: created.id,
    payload: { source: CHATGPT_SOURCE, hasPath: Boolean(path), pathIsNew },
    context: eventContext(ctx),
  });
  scheduleEmbeddingRefresh();
  return {
    ...created,
    url: noteUrl(ctx, created.id),
    version: 1,
    pathIsNew,
    deduplicated: false,
  };
}

const ownedDocSelect = {
  id: true,
  title: true,
  path: true,
  html: true,
  markdown: true,
  originalSource: true,
} as const;

async function loadOwnedNote(id: string) {
  const doc = await prisma.doc.findUnique({
    where: { id },
    select: ownedDocSelect,
  });
  if (!doc) throw new ConnectorError("not_found", `No note with id ${id}`);
  if (!isChatGptNote(doc)) {
    throw new ConnectorError(
      "not_owner",
      "This note was written by the user, so it is read-only for ChatGPT. Create a new note that links to it instead.",
    );
  }
  return doc;
}

type OwnedNote = Awaited<ReturnType<typeof loadOwnedNote>>;

/** Snapshots the current note, then applies the change, in one transaction. */
async function applyOwnedEdit(
  ctx: ConnectorContext,
  doc: OwnedNote,
  reason: "chatgpt.update" | "chatgpt.append",
  changes: { title?: string; path?: string | null; content?: NoteContent },
): Promise<WriteResult> {
  const [, updated] = await prisma.$transaction([
    prisma.docRevision.create({
      data: {
        docId: doc.id,
        title: doc.title,
        path: doc.path,
        markdown: doc.markdown,
        html: doc.html,
        actorType: "chatgpt",
        reason,
      },
    }),
    prisma.doc.update({
      where: { id: doc.id },
      data: {
        ...(changes.title !== undefined ? { title: changes.title } : {}),
        ...(changes.path !== undefined ? { path: changes.path } : {}),
        ...(changes.content
          ? {
              ...changes.content,
              contentHash: sha256(changes.content.markdown),
            }
          : {}),
      },
      select: { id: true, title: true, path: true },
    }),
  ]);
  await logActionEvent({
    eventType: "doc.update",
    entityType: "doc",
    entityId: doc.id,
    relatedDocId: doc.id,
    payload: {
      source: CHATGPT_SOURCE,
      reason,
      fieldsChanged: Object.keys(changes).filter(
        (field) => changes[field as keyof typeof changes] !== undefined,
      ),
    },
    context: eventContext(ctx),
  });
  scheduleEmbeddingRefresh();
  return {
    ...updated,
    url: noteUrl(ctx, doc.id),
    version: await countVersions(doc.id),
  };
}

export async function updateNote(
  ctx: ConnectorContext,
  input: { id: string; title?: string; path?: string; markdown?: string },
): Promise<WriteResult> {
  const title = input.title?.trim();
  if (input.title !== undefined && !title)
    throw new ConnectorError("invalid", "title cannot be empty");
  if (input.markdown !== undefined && !input.markdown.trim()) {
    throw new ConnectorError("invalid", "markdown cannot be empty");
  }
  if (
    title === undefined &&
    input.path === undefined &&
    input.markdown === undefined
  ) {
    throw new ConnectorError(
      "invalid",
      "Nothing to update: pass title, path, or markdown",
    );
  }
  const doc = await loadOwnedNote(input.id);
  return applyOwnedEdit(ctx, doc, "chatgpt.update", {
    title,
    path: input.path === undefined ? undefined : normalizeNotePath(input.path),
    content:
      input.markdown === undefined
        ? undefined
        : contentFromMarkdown(input.markdown),
  });
}

export async function appendToNote(
  ctx: ConnectorContext,
  input: { id: string; markdown: string },
): Promise<WriteResult> {
  if (!input.markdown.trim())
    throw new ConnectorError("invalid", "markdown is required");
  const doc = await loadOwnedNote(input.id);
  return applyOwnedEdit(ctx, doc, "chatgpt.append", {
    content: appendMarkdown(doc, input.markdown),
  });
}
