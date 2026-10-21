import { action } from "@solidjs/router";
import { z } from "zod";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import { metaActionSchema, updateNotesMeta } from "~/server/notes/note-meta";
import type { BulkMetaAction } from "./docs.types";

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(1000),
});

const bulkMetaSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(2000),
  actions: z.array(metaActionSchema).min(1).max(50),
});

const sourceSchema = z.object({
  originalSource: z.string().trim().min(1).max(128),
});

export const deleteAllDocs = action(async () => {
  "use server";
  const count = await prisma.doc.count();
  await prisma.$transaction([prisma.doc.deleteMany({})]);
  await logActionEvent({
    eventType: "doc.bulk_delete",
    entityType: "doc",
    payload: { scope: "all", deletedCount: count },
  });
  return { ok: true };
}, "docs-delete-all");

export const deleteBySource = action(async (source: string) => {
  "use server";
  if (!source) throw new Error("Missing originalSource");
  const result = await prisma.doc.deleteMany({
    where: { originalSource: source },
  });
  await logActionEvent({
    eventType: "doc.bulk_delete",
    entityType: "doc",
    payload: {
      scope: "source",
      source,
      deletedCount: result.count,
    },
  });
  return { ok: true, deletedCount: result.count };
}, "docs-delete-by-source");

export const bulkSetSource = action(async (value: string) => {
  "use server";
  const input = sourceSchema.parse({ originalSource: value });
  const result = await prisma.doc.updateMany({
    data: { originalSource: input.originalSource },
  });
  await logActionEvent({
    eventType: "doc.bulk_update_meta",
    entityType: "doc",
    payload: {
      scope: "set_source",
      source: input.originalSource,
      updatedCount: result.count,
    },
  });
  return { ok: true, updatedCount: result.count };
}, "docs-set-source");

export const bulkDeleteDocs = action(async (ids: string[]) => {
  "use server";
  const parsed = bulkDeleteSchema.parse({ ids });
  const uniqueIds = Array.from(new Set(parsed.ids));
  const result = await prisma.doc.deleteMany({
    where: { id: { in: uniqueIds } },
  });
  await logActionEvent({
    eventType: "doc.bulk_delete",
    entityType: "doc",
    payload: {
      scope: "selection",
      requestedCount: uniqueIds.length,
      deletedCount: result.count,
    },
  });
  return { ok: true, deletedCount: result.count };
}, "docs-bulk-delete");

export const bulkUpdateMeta = action(
  async (ids: string[], actions: BulkMetaAction[]) => {
    "use server";
    const parsed = bulkMetaSchema.parse({ ids, actions });
    const uniqueIds = Array.from(new Set(parsed.ids));
    if (uniqueIds.length === 0) return { ok: true, updated: 0 };

    const updated = (await updateNotesMeta(uniqueIds, parsed.actions)).length;

    await logActionEvent({
      eventType: "doc.bulk_update_meta",
      entityType: "doc",
      payload: {
        scope: "selection",
        requestedCount: uniqueIds.length,
        updatedCount: updated,
        actions: parsed.actions.map((action) => action.type),
      },
    });
    return { ok: true, updated };
  },
  "docs-bulk-meta",
);
