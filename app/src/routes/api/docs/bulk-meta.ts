import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "~/server/db";

const jsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add"), key: z.string().min(1).max(128), value: jsonPrimitive }),
  z.object({ type: z.literal("update"), key: z.string().min(1).max(128), value: jsonPrimitive }),
  z.object({ type: z.literal("remove"), key: z.string().min(1).max(128) }),
]);

const inputSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(2000),
  actions: z.array(actionSchema).min(1).max(50),
});

type Action = z.infer<typeof actionSchema>;

type MetaValue = Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;

function applyActionsToMeta(
  current: Prisma.JsonValue | null | undefined,
  actions: Action[]
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

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const { ids, actions } = inputSchema.parse(body);

    const uniqueIds = Array.from(new Set(ids));
    console.log(
      "[api.docs.bulk-meta] starting ids=%d actions=%d",
      uniqueIds.length,
      actions.length
    );

    if (uniqueIds.length === 0) return json({ ok: true, updated: 0 });

    // Read current metas for all ids
    const rows = await prisma.doc.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, meta: true },
    });

    // Map for quick lookup
    const byId = new Map<string, Prisma.JsonValue | null>();
    for (const r of rows) byId.set(r.id, r.meta ?? null);

    const updates: { id: string; next: Record<string, MetaValue> }[] = [];
    for (const id of uniqueIds) {
      const current = byId.get(id) ?? null;
      const next = applyActionsToMeta(current, actions);
      updates.push({ id, next });
    }

    if (updates.length === 0) return json({ ok: true, updated: 0 });

    // Chunk updates to avoid oversized transactions
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
        try {
          console.error("[api.docs.bulk-meta] chunk failed, retrying individually", e);
        } catch {}
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

    console.log("[api.docs.bulk-meta] completed updated=%d", updated);
    return json({ ok: true, updated });
  } catch (e) {
    const msg = (e as Error).message || "Failed to bulk update metadata";
    return json({ error: msg }, { status: 400 });
  }
}


