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
import type { Prisma } from "@prisma/client";
import { hasContentInput, prepareContent } from "~/server/notes/note-store";
import { writeNoteContent } from "~/server/notes/note-write";

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
  /** contentVersion the editor started from; enables per-block merge. */
  baseVersion: z.number().int().optional(),
  baseHashes: z.record(z.string()).optional(),
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
  const updates: Prisma.DocUpdateInput = {};
  const fieldsChanged: string[] = [];
  const contentChange = hasContentInput(input);

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
  if (!contentChange && Object.keys(updates).length === 0) {
    throw new Error("No valid fields to update");
  }

  let prevContentLength = 0;
  let nextContentLength = 0;
  const result = await prisma.$transaction(async (tx) => {
    if (!contentChange) {
      const row = await tx.doc.update({
        where: { id: input.id },
        data: updates,
        select: { id: true, updatedAt: true, contentVersion: true },
      });
      return { ...row, merged: null, conflicts: [] as string[] };
    }
    const existing = await tx.doc.findUnique({
      where: { id: input.id },
      select: { html: true },
    });
    if (!existing) throw new Error("Not found");
    prevContentLength = existing.html.length;
    fieldsChanged.push("content");
    const write = await writeNoteContent(tx, {
      docId: input.id,
      doc: prepareContent(input),
      baseVersion: input.baseVersion,
      baseHashes: input.baseHashes,
      actorType: "magic_user",
      extra: updates,
    });
    return write;
  });
  if (contentChange) {
    const saved = await prisma.doc.findUnique({
      where: { id: result.id },
      select: { html: true },
    });
    nextContentLength = saved?.html.length ?? 0;
  }

  await logDocUpdate(result.id, Array.from(new Set(fieldsChanged)), {
    hasContentChange: contentChange,
    contentLengthDeltaBucket: contentChange
      ? lengthDeltaBucket(prevContentLength, nextContentLength)
      : "not_applicable",
  });
  return {
    id: result.id,
    updatedAt: result.updatedAt.toISOString(),
    contentVersion: result.contentVersion,
    /** Present when the save was merged with newer stored content. */
    mergedContent: result.merged,
    conflicts: result.conflicts,
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
