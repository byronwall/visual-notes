import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "~/server/db";

// Note `meta` (flat key → primitive) changes shared by the notes index bulk
// action and the MCP connector. Meta is not note content, so it is written
// directly; the note-change extension still tells open tabs.

const jsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const metaActionSchema = z.discriminatedUnion("type", [
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
  z.object({ type: z.literal("remove"), key: z.string().min(1).max(128) }),
]);

export type MetaAction = z.infer<typeof metaActionSchema>;

type MetaValue = Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;

/** `add` keeps an existing key; `update` sets it; `remove` drops it. */
export function applyMetaActions(
  current: Prisma.JsonValue | null | undefined,
  actions: MetaAction[],
): Record<string, MetaValue> {
  const base: Record<string, MetaValue> =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, MetaValue>)
      : {};
  const next: Record<string, MetaValue> = { ...base };
  for (const a of actions) {
    if (a.type === "remove") {
      delete next[a.key];
    } else if (a.type === "update" || !(a.key in next)) {
      next[a.key] = a.value === null ? Prisma.JsonNull : a.value;
    }
  }
  return next;
}

/** Plain-object view of a stored meta column. */
export function readMeta(
  value: Prisma.JsonValue | null | undefined,
): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Applies `actions` to every note in `ids`, in chunks; a failed chunk is
 * retried one note at a time. Returns the ids that were updated.
 */
export async function updateNotesMeta(
  ids: string[],
  actions: MetaAction[],
): Promise<string[]> {
  const rows = await prisma.doc.findMany({
    where: { id: { in: Array.from(new Set(ids)) } },
    select: { id: true, meta: true },
  });
  const updates = rows.map((r) => ({
    id: r.id,
    next: applyMetaActions(r.meta, actions),
  }));
  const write = (u: (typeof updates)[number]) =>
    prisma.doc.update({
      where: { id: u.id },
      data: { meta: u.next as unknown as Prisma.InputJsonValue },
    });
  const updated: string[] = [];
  const chunkSize = 100;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    try {
      await prisma.$transaction(chunk.map(write));
      updated.push(...chunk.map((u) => u.id));
    } catch (e) {
      console.error("[docs.bulk-meta] chunk failed, retrying individually", e);
      for (const u of chunk) {
        try {
          await write(u);
          updated.push(u.id);
        } catch {
          // skip failed item
        }
      }
    }
  }
  return updated;
}

type Counted<K extends string> = { [P in K]: string } & { count: number };

function byCount<K extends string>(
  name: K,
  counts: Map<string, number>,
): Counted<K>[] {
  return Array.from(counts.entries())
    .map(([value, count]) => ({ [name]: value, count }) as Counted<K>)
    .sort((a, b) => b.count - a.count);
}

/** Every meta key in use, with how many notes carry it, most used first. */
export async function listMetaKeys(): Promise<Counted<"key">[]> {
  const docs = await prisma.doc.findMany({
    where: { meta: { not: Prisma.DbNull } },
    select: { meta: true },
  });
  const counts = new Map<string, number>();
  for (const d of docs) {
    for (const k of Object.keys(readMeta(d.meta))) {
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  return byCount("key", counts);
}

/** The values one meta key holds, as text, with note counts. */
export async function listMetaValues(
  key: string,
): Promise<Counted<"value">[]> {
  if (!key) return [];
  const docs = await prisma.doc.findMany({
    where: { meta: { path: [key], not: Prisma.AnyNull } },
    select: { meta: true },
  });
  const counts = new Map<string, number>();
  for (const d of docs) {
    const raw = readMeta(d.meta)[key];
    if (raw === null || raw === undefined) continue;
    const val = String(raw);
    counts.set(val, (counts.get(val) || 0) + 1);
  }
  return byCount("value", counts);
}
