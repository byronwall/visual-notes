import { action } from "@solidjs/router";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import type { BulkMetaAction } from "./docs.types";

const jsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const bulkMetaActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add"),
    key: z.string().min(1).max(128),
    value: jsonPrimitive,
  }),
  z.object({
    type: z.literal("update"),
    key: z.string().min(1).max(128),
    value: jsonPrimitive,
  }),
  z.object({
    type: z.literal("remove"),
    key: z.string().min(1).max(128),
  }),
]);

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(1000),
});

const bulkMetaSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(2000),
  actions: z.array(bulkMetaActionSchema).min(1).max(50),
});

const sourceSchema = z.object({
  originalSource: z.string().min(1).max(128),
});

type MetaValue = Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;

type MetaAction = z.infer<typeof bulkMetaActionSchema>;

function applyActionsToMeta(
  current: Prisma.JsonValue | null | undefined,
  actions: MetaAction[]
): Record<string, MetaValue> {
  const base: Record<string, MetaValue> =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, MetaValue>)
      : {};
  const next: Record<string, MetaValue> = { ...base };
  for (const a of actions) {
    const key = a.key;
    if (a.type === "remove") {
      if (key in next) delete next[key];
      continue;
    }
    if (a.type === "add") {
      if (!(key in next))
        next[key] = a.value === null ? Prisma.JsonNull : a.value;
      continue;
    }
    if (a.type === "update") {
      next[key] = a.value === null ? Prisma.JsonNull : a.value;
      continue;
    }
  }
  return next;
}

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
  const result = await prisma.doc.deleteMany({ where: { originalSource: source } });
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

    const rows = await prisma.doc.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, meta: true },
    });

    const byId = new Map<string, Prisma.JsonValue | null>();
    for (const r of rows) byId.set(r.id, r.meta ?? null);

    const updates: { id: string; next: Record<string, MetaValue> }[] = [];
    for (const id of uniqueIds) {
      const current = byId.get(id) ?? null;
      const next = applyActionsToMeta(current, parsed.actions);
      updates.push({ id, next });
    }

    if (updates.length === 0) return { ok: true, updated: 0 };

    const chunkSize = 100;
    let updated = 0;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      try {
        await prisma.$transaction(
          chunk.map((u) =>
            prisma.doc.update({
              where: { id: u.id },
              data: { meta: u.next as unknown as Prisma.InputJsonValue },
            })
          )
        );
        updated += chunk.length;
      } catch (e) {
        console.error("[docs.bulk-meta] chunk failed, retrying individually", e);
        for (const u of chunk) {
          try {
            await prisma.doc.update({
              where: { id: u.id },
              data: { meta: u.next as unknown as Prisma.InputJsonValue },
            });
            updated++;
          } catch (_e) {
            // skip failed item
          }
        }
      }
    }

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
  "docs-bulk-meta"
);
