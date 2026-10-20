import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import {
  contentColumns,
  prepareContent,
  type ContentInput,
} from "./note-store";
import { rebuildNoteIndex } from "./note-index";

export type CreateNoteInput = ContentInput & {
  title: string;
  path?: string;
  meta?: Record<string, string | number | boolean | null>;
};

/** Creates a note from in-app input. Server-only. */
export async function createNoteRecord(input: CreateNoteInput) {
  const content = prepareContent(input);
  const path = input.path?.trim() ? input.path.trim() : null;
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.doc.create({
      data: {
        title: input.title,
        ...contentColumns(content),
        contentVersion: 1,
        path,
        meta: input.meta,
      },
      select: { id: true },
    });
    await rebuildNoteIndex(tx, row.id, content);
    return row;
  });
  await logActionEvent({
    eventType: "doc.create",
    entityType: "doc",
    entityId: created.id,
    relatedDocId: created.id,
    payload: {
      source: null,
      hasPath: Boolean(path),
      hasMeta: Boolean(input.meta && Object.keys(input.meta).length > 0),
    },
  });
  return { id: created.id };
}
