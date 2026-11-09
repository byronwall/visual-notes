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
const QUOTE_MAX = 1_000;

type AnnotationRow = {
  id: string;
  docId: string | null;
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
  });
  return rows.map(toAnnotationView);
}

export async function createAnnotation(input: {
  docId: string;
  typeId?: string;
  body?: string;
  author?: string;
  blockId?: string | null;
  quote?: string | null;
  quoteStart?: number | null;
  context?: LogActionEventInput["context"];
}): Promise<AnnotationView> {
  const doc = await prisma.doc.findUnique({
    where: { id: input.docId },
    select: { id: true, title: true },
  });
  if (!doc) throw new AnnotationError(`No note with id ${input.docId}`);
  const quote = input.quote?.slice(0, QUOTE_MAX) || null;
  if (input.blockId && !quote) throw new AnnotationError("A passage annotation needs the quoted text");
  const typeId = input.typeId ?? (await defaultTypeId());
  if (!(await prisma.annotationType.findUnique({ where: { id: typeId } }))) {
    throw new AnnotationError(`No annotation type ${typeId}`);
  }
  const row = await prisma.annotation.create({
    data: {
      docId: doc.id,
      typeId,
      body: (input.body ?? "").trim().slice(0, BODY_MAX),
      author: input.author ?? "you",
      blockId: input.blockId ?? null,
      quote,
      quoteStart: input.blockId ? (input.quoteStart ?? 0) : null,
    },
  });
  await logActionEvent({
    eventType: "annotation.create",
    entityType: "doc",
    entityId: doc.id,
    relatedDocId: doc.id,
    payload: { annotationId: row.id, docTitle: doc.title, quote: quote?.slice(0, 120) ?? null },
    context: input.context,
  });
  publishAppChange("inbox", [doc.id]);
  return toAnnotationView(row);
}

export async function updateAnnotation(input: {
  id: string;
  body?: string;
  typeId?: string;
}): Promise<AnnotationView> {
  if (input.typeId && !(await prisma.annotationType.findUnique({ where: { id: input.typeId } }))) {
    throw new AnnotationError(`No annotation type ${input.typeId}`);
  }
  const row = await prisma.annotation.update({
    where: { id: input.id },
    data: {
      ...(input.body !== undefined ? { body: input.body.trim().slice(0, BODY_MAX) } : {}),
      ...(input.typeId ? { typeId: input.typeId } : {}),
    },
  });
  publishAppChange("inbox", row.docId ? [row.docId] : null);
  return toAnnotationView(row);
}

export async function deleteAnnotation(id: string): Promise<void> {
  const row = await prisma.annotation.delete({ where: { id } });
  publishAppChange("inbox", row.docId ? [row.docId] : null);
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
