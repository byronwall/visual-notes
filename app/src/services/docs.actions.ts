import { action, json } from "@solidjs/router";
import { fetchDocActivityHistory } from "~/services/activity/activity.queries";
import { fetchDocs as fetchDocsList } from "~/features/docs-index/data/docs.queries.list";
import { z } from "zod";
import { prisma } from "~/server/db";
import {
  lengthDeltaBucket,
  logActionEvent,
  logDocUpdate,
} from "~/server/events/action-events";
import { createNoteRecord } from "~/server/notes/create-note";
import {
  contentColumns,
  hasContentInput,
  prepareContent,
} from "~/server/notes/note-store";
import { rebuildNoteIndex } from "~/server/notes/note-index";
import type { NoteDoc } from "~/lib/note-content/types";

const jsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const createInput = z
  .object({
    title: z.string().min(1).max(200),
    content: z.unknown().optional(),
    markdown: z.string().min(1).optional(),
    html: z.string().min(1).optional(),
    path: z.string().max(512).optional(),
    meta: z.record(jsonPrimitive).optional(),
  })
  .refine((v) => Boolean(v.content || v.markdown || v.html), {
    message: "content, markdown, or html is required",
    path: ["markdown"],
  });

const updateInput = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  content: z.unknown().optional(),
  markdown: z.string().min(1).optional(),
  html: z.string().min(1).optional(),
  path: z.string().max(512).optional(),
  meta: z.record(jsonPrimitive).optional(),
});

export const createDoc = action(
  async (payload: z.infer<typeof createInput>) => {
    "use server";
    return createNoteRecord(createInput.parse(payload));
  },
  "docs-create",
);

// Shared by the update actions below; only ever runs inside a server action.
async function applyDocUpdate(payload: z.infer<typeof updateInput>) {
  const input = updateInput.parse(payload);
  const updates: Record<string, any> = {};
  const fieldsChanged: string[] = [];
  const contentChange = hasContentInput(input);
  let nextDoc: NoteDoc | undefined;
  let prevContentLength = 0;
  let nextContentLength = 0;

  if (contentChange) {
    const existing = await prisma.doc.findUnique({
      where: { id: input.id },
      select: { html: true },
    });
    if (!existing) throw new Error("Not found");
    prevContentLength = String(existing.html || "").length;
    nextDoc = prepareContent(input);
    const columns = contentColumns(nextDoc);
    Object.assign(updates, columns, { contentVersion: { increment: 1 } });
    fieldsChanged.push("content");
    nextContentLength = columns.html.length;
  }

  if (input.title !== undefined) {
    updates.title = input.title;
    fieldsChanged.push("title");
  }
  if (input.path !== undefined) {
    updates.path = input.path.trim().length ? input.path.trim() : null;
    fieldsChanged.push("path");
  }
  if (input.meta !== undefined) {
    updates.meta = input.meta;
    fieldsChanged.push("meta");
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No valid fields to update");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.doc.update({
      where: { id: input.id },
      data: updates,
      select: { id: true, updatedAt: true, contentVersion: true },
    });
    if (nextDoc) await rebuildNoteIndex(tx, row.id, nextDoc);
    return row;
  });

  await logDocUpdate(updated.id, Array.from(new Set(fieldsChanged)), {
    hasContentChange: contentChange,
    contentLengthDeltaBucket: contentChange
      ? lengthDeltaBucket(prevContentLength, nextContentLength)
      : "not_applicable",
  });
  return {
    id: updated.id,
    updatedAt: updated.updatedAt.toISOString(),
    contentVersion: updated.contentVersion,
  };
}

export const updateDoc = action(
  async (payload: z.infer<typeof updateInput>) => {
    "use server";
    return applyDocUpdate(payload);
  },
  "docs-update",
);

/**
 * Same write as `updateDoc`, for editor autosave. A bare action revalidates
 * every cached query, so each autosave refetched the full note (twice),
 * prompts, and AI models. This one refreshes only what a content save
 * changes: the note's activity and the recent-notes list.
 */
export const saveDocContent = action(
  async (payload: z.infer<typeof updateInput>) => {
    "use server";
    const result = await applyDocUpdate(payload);
    return json(result, {
      revalidate: [
        fetchDocActivityHistory.keyFor(result.id),
        fetchDocsList.key,
      ],
    });
  },
  "docs-save-content",
);

export const deleteDoc = action(async (id: string) => {
  "use server";
  if (!id) throw new Error("Missing id");
  const deleted = await prisma.doc
    .delete({ where: { id }, select: { id: true } })
    .catch(() => null);
  if (!deleted) throw new Error("Not found");
  await logActionEvent({
    eventType: "doc.delete",
    entityType: "doc",
    entityId: id,
    relatedDocId: id,
  });
  return { ok: true, id: deleted.id };
}, "docs-delete");
