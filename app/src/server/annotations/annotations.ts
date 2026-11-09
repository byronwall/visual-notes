import { prisma } from "~/server/db";
import {
  logActionEvent,
  type LogActionEventInput,
} from "~/server/events/action-events";
import { publishAppChange } from "~/server/note-events";
import type { AnchorUpdate, AnnotationView } from "~/lib/annotations/types";
import { defaultTypeId } from "./annotation-types";
import { AnnotationError } from "./errors";

// Annotations on notes: a passage (block id + quoted text) or the whole note.
// They live beside the note, so adding one never changes the note's text,
// revisions, or search.

export const BODY_MAX = 4_000;
export const withMessages = { messages: { orderBy: { createdAt: "asc" as const } } };
const QUOTE_MAX = 1_000;

type AnnotationRow = {
  id: string;
  docId: string | null;
  taskId: string | null;
  status: string | null;
  claimedBy: string | null;
  messages?: { id: string; author: string; body: string; createdAt: Date }[];
  typeId: string;
  body: string;
  author: string;
  blockId: string | null;
  quote: string | null;
  quoteStart: number | null;
  detachedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export const toAnnotationView = (row: AnnotationRow): AnnotationView => ({
  id: row.id,
  docId: row.docId,
  taskId: row.taskId,
  status: row.status as AnnotationView["status"],
  claimedBy: row.claimedBy,
  messages: (row.messages ?? []).map((m) => ({
    id: m.id,
    author: m.author,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  })),
  typeId: row.typeId,
  body: row.body,
  author: row.author,
  blockId: row.blockId,
  quote: row.quote,
  quoteStart: row.quoteStart,
  detached: row.detachedAt !== null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export async function listNoteAnnotations(docId: string): Promise<AnnotationView[]> {
  const rows = await prisma.annotation.findMany({
    where: { docId },
    orderBy: { createdAt: "asc" },
    include: withMessages,
  });
  return rows.map(toAnnotationView);
}

export async function createAnnotation(input: {
  docId?: string | null;
  taskId?: string | null;
  typeId?: string;
  body?: string;
  author?: string;
  blockId?: string | null;
  quote?: string | null;
  quoteStart?: number | null;
  context?: LogActionEventInput["context"];
}): Promise<AnnotationView> {
  const target = await loadTarget(input);
  const quote = input.quote?.slice(0, QUOTE_MAX) || null;
  if (input.blockId && !quote) throw new AnnotationError("A passage annotation needs the quoted text");
  const typeId = input.typeId ?? (await defaultTypeId());
  const type = await prisma.annotationType.findUnique({ where: { id: typeId } });
  if (!type) throw new AnnotationError(`No annotation type ${typeId}`);
  const author = input.author ?? "you";
  const row = await prisma.annotation.create({
    data: {
      docId: target.docId,
      taskId: target.taskId,
      typeId,
      body: (input.body ?? "").trim().slice(0, BODY_MAX),
      author,
      blockId: input.blockId ?? null,
      quote,
      quoteStart: input.blockId ? (input.quoteStart ?? 0) : null,
      status: type.forAi ? "open" : null,
      lastAgentAt: author === "you" ? null : new Date(),
    },
    include: withMessages,
  });
  await logActionEvent({
    eventType: type.forAi ? "annotation.request" : "annotation.create",
    entityType: target.taskId ? "task" : "doc",
    entityId: target.taskId ?? target.docId,
    relatedDocId: target.docId,
    payload: {
      annotationId: row.id,
      title: target.title,
      type: type.name,
      quote: quote?.slice(0, 120) ?? null,
      body: row.body.slice(0, 160),
    },
    context: input.context,
  });
  publishTarget(row);
  return toAnnotationView(row);
}

async function loadTarget(input: { docId?: string | null; taskId?: string | null }) {
  if (input.taskId) {
    const task = await prisma.taskItem.findUnique({
      where: { id: input.taskId },
      select: { id: true, description: true },
    });
    if (!task) throw new AnnotationError(`No task with id ${input.taskId}`);
    return { docId: null, taskId: task.id, title: task.description };
  }
  if (!input.docId) throw new AnnotationError("An annotation needs a note or a task");
  const doc = await prisma.doc.findUnique({
    where: { id: input.docId },
    select: { id: true, title: true },
  });
  if (!doc) throw new AnnotationError(`No note with id ${input.docId}`);
  return { docId: doc.id, taskId: null, title: doc.title };
}

/** Tells open tabs that a note's or a task's annotations changed. */
export const publishTarget = (row: { docId: string | null; taskId: string | null }) =>
  publishAppChange("inbox", [row.docId ?? row.taskId ?? ""].filter(Boolean));

export async function updateAnnotation(input: {
  id: string;
  body?: string;
  typeId?: string;
}): Promise<AnnotationView> {
  const current = await prisma.annotation.findUnique({ where: { id: input.id } });
  if (!current) throw new AnnotationError(`No annotation ${input.id}`);
  let status: string | null | undefined;
  if (input.typeId) {
    const type = await prisma.annotationType.findUnique({ where: { id: input.typeId } });
    if (!type) throw new AnnotationError(`No annotation type ${input.typeId}`);
    // Becoming a request opens it; leaving the For AI types drops the state.
    status = type.forAi ? (current.status ?? "open") : null;
  }
  const row = await prisma.annotation.update({
    where: { id: input.id },
    data: {
      ...(input.body !== undefined ? { body: input.body.trim().slice(0, BODY_MAX) } : {}),
      ...(input.typeId ? { typeId: input.typeId, status } : {}),
    },
    include: withMessages,
  });
  publishTarget(row);
  return toAnnotationView(row);
}

export async function deleteAnnotation(id: string): Promise<void> {
  const row = await prisma.annotation.delete({ where: { id } });
  publishTarget(row);
}

/**
 * Records where passages sit after the editor saved the note: the block,
 * the quoted text, and whether the passage was deleted. Called right after a
 * content save, so the anchors match the stored note.
 */
export async function saveAnchors(docId: string, updates: AnchorUpdate[]): Promise<number> {
  if (updates.length === 0) return 0;
  const now = new Date();
  const results = await prisma.$transaction(
    updates.map((update) =>
      prisma.annotation.updateMany({
        where: { id: update.id, docId },
        data: {
          blockId: update.blockId,
          quote: update.quote.slice(0, QUOTE_MAX),
          quoteStart: update.quoteStart,
          detachedAt: update.detached ? now : null,
        },
      }),
    ),
  );
  publishAppChange("inbox", [docId]);
  return results.reduce((sum, r) => sum + r.count, 0);
}
