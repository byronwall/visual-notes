import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import { publishAppChange } from "~/server/note-events";
import { ResearchIngestError, type IngestResult } from "./research.ingest";

// Card edits and removals as undoable batches, for agents and the canvas
// alike. A batch's `result` keeps the before/after values, so undo can put
// them back and redo can apply them again.

type Tx = Prisma.TransactionClient;

const EDITABLE_CARD_FIELDS = ["title", "body", "url", "snippet", "imageUrl"] as const;
export type CardFields = {
  title?: string;
  body?: string;
  url?: string | null;
  snippet?: string | null;
  imageUrl?: string | null;
};

export type CardEdit = { id: string; before: CardFields; after: CardFields };

/** What an edit or removal batch stores in `ResearchBatch.result`. */
export type EditEffects = { cardEdits?: CardEdit[]; removedIds?: string[] };

type BatchInput = { batchKey: string; agent: string };

const emptyCounts = { refs: {}, cardCount: 0, linkCount: 0, summaryCount: 0 };

const sameFields = (current: Record<string, unknown>, fields: CardFields) =>
  Object.entries(fields).every(([key, value]) => (current[key] ?? null) === (value ?? null));

const cleanFields = (input: Record<string, string | null | undefined>): CardFields => {
  const out: CardFields = {};
  for (const field of EDITABLE_CARD_FIELDS) {
    if (!(field in input) || input[field] === undefined) continue;
    const value = input[field];
    if (field === "title") {
      const title = String(value ?? "").trim();
      if (title) out.title = title.slice(0, 300);
    } else if (field === "body") {
      out.body = String(value ?? "").slice(0, 20_000);
    } else {
      out[field] = value === null || String(value).trim() === "" ? null : String(value).trim();
    }
  }
  return out;
};

async function existingBatch(topicId: string, batchKey: string): Promise<IngestResult | null> {
  const batch = await prisma.researchBatch.findUnique({
    where: { topicId_batchKey: { topicId, batchKey } },
  });
  return batch ? { batchId: batch.id, batchKey, replayed: true, ...emptyCounts } : null;
}

async function createBatch(
  tx: Tx,
  topicId: string,
  input: BatchInput,
  summary: string,
  effects: EditEffects,
): Promise<IngestResult> {
  const batchId = randomUUID();
  await tx.researchBatch.create({
    data: {
      id: batchId,
      topicId,
      batchKey: input.batchKey,
      agent: input.agent,
      summary,
      result: { ...emptyCounts, ...effects } as unknown as Prisma.InputJsonValue,
    },
  });
  await tx.researchTopic.update({ where: { id: topicId }, data: { updatedAt: new Date() } });
  return { batchId, batchKey: input.batchKey, replayed: false, ...emptyCounts };
}

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/** Change card text, links, or images as one undoable batch. */
export const editCards = async (
  topicId: string,
  input: BatchInput & { edits: ({ id: string } & CardFields)[] },
): Promise<IngestResult> => {
  const replayed = await existingBatch(topicId, input.batchKey);
  if (replayed) return replayed;
  const result = await prisma.$transaction(async (tx) => {
    const cards = await tx.researchCard.findMany({
      where: { topicId, hiddenAt: null, id: { in: input.edits.map((edit) => edit.id) } },
    });
    const byId = new Map(cards.map((card) => [card.id, card]));
    const issues: string[] = [];
    const edits: CardEdit[] = [];
    for (const { id, ...fields } of input.edits) {
      const card = byId.get(id);
      const after = cleanFields(fields);
      if (!card) issues.push(`no card "${id}" in this topic`);
      else if (!Object.keys(after).length) issues.push(`edit for "${id}" changes nothing (title cannot be empty)`);
      else {
        const before = Object.fromEntries(
          Object.keys(after).map((key) => [key, (card as Record<string, unknown>)[key] ?? null]),
        ) as CardFields;
        if (!sameFields(card as Record<string, unknown>, after)) edits.push({ id, before, after });
      }
    }
    if (issues.length) throw new ResearchIngestError(issues);
    if (!edits.length) throw new ResearchIngestError(["every edit matches the card already"]);
    for (const edit of edits) {
      await tx.researchCard.update({ where: { id: edit.id }, data: edit.after });
    }
    const only = edits.length === 1 ? byId.get(edits[0].id) : null;
    const summary = only ? `Edited “${edits[0].after.title ?? only.title}”` : `Edited ${plural(edits.length, "card")}`;
    return createBatch(tx, topicId, input, summary, { cardEdits: edits });
  });
  publishAppChange("research", [topicId]);
  return result;
};

/**
 * Hide cards as one undoable batch. A card with visible children can only go
 * with them, so nothing is left hanging from a removed card.
 */
export const removeCards = async (
  topicId: string,
  input: BatchInput & { ids: string[] },
): Promise<IngestResult> => {
  const replayed = await existingBatch(topicId, input.batchKey);
  if (replayed) return replayed;
  const ids = [...new Set(input.ids)];
  const result = await prisma.$transaction(async (tx) => {
    const cards = await tx.researchCard.findMany({
      where: { topicId, hiddenAt: null, id: { in: ids } },
      select: { id: true, title: true },
    });
    const found = new Set(cards.map((card) => card.id));
    const issues = ids.filter((id) => !found.has(id)).map((id) => `no card "${id}" in this topic`);
    const children = await tx.researchCard.findMany({
      where: { parentId: { in: ids }, hiddenAt: null, id: { notIn: ids } },
      select: { id: true, parentId: true },
    });
    for (const child of children) {
      issues.push(`card "${child.parentId}" still has child "${child.id}"; remove it too or move on`);
    }
    if (issues.length) throw new ResearchIngestError(issues);
    await tx.researchCard.updateMany({ where: { id: { in: ids } }, data: { hiddenAt: new Date() } });
    const summary = cards.length === 1 ? `Removed “${cards[0].title}”` : `Removed ${plural(cards.length, "card")}`;
    return createBatch(tx, topicId, input, summary, { removedIds: ids });
  });
  publishAppChange("research", [topicId]);
  return result;
};

/**
 * Reverts a batch's edits and removals inside undo. Returns a reason when a
 * card changed after this batch, so the older undo would clobber it.
 */
export async function revertEffects(tx: Tx, effects: EditEffects): Promise<string | null> {
  const edits = effects.cardEdits ?? [];
  if (edits.length) {
    const cards = await tx.researchCard.findMany({ where: { id: { in: edits.map((e) => e.id) } } });
    const byId = new Map(cards.map((card) => [card.id, card as Record<string, unknown>]));
    if (edits.some((edit) => !byId.has(edit.id) || !sameFields(byId.get(edit.id)!, edit.after))) {
      return "A card in this batch was edited again later; undo that edit first.";
    }
    for (const edit of edits) await tx.researchCard.update({ where: { id: edit.id }, data: edit.before });
  }
  if (effects.removedIds?.length) {
    // Bring back only cards whose own batch still stands.
    await tx.researchCard.updateMany({
      where: {
        id: { in: effects.removedIds },
        OR: [{ batchId: null }, { batch: { undoneAt: null } }],
      },
      data: { hiddenAt: null },
    });
  }
  return null;
}

/** Applies a batch's edits and removals again inside redo. */
export async function reapplyEffects(tx: Tx, effects: EditEffects): Promise<void> {
  for (const edit of effects.cardEdits ?? []) {
    await tx.researchCard.update({ where: { id: edit.id }, data: edit.after });
  }
  if (effects.removedIds?.length) {
    await tx.researchCard.updateMany({ where: { id: { in: effects.removedIds } }, data: { hiddenAt: new Date() } });
  }
}

/** Rename and/or archive a topic. */
export const updateTopic = async (
  topicId: string,
  input: { title?: string; archived?: boolean },
): Promise<{ id: string; slug: string; title: string; archivedAt: string | null }> => {
  const title = input.title?.trim();
  if (input.title !== undefined && !title) throw new ResearchIngestError(["title cannot be empty"]);
  if (title === undefined && input.archived === undefined) {
    throw new ResearchIngestError(["pass title and/or archived"]);
  }
  const topic = await prisma.researchTopic.update({
    where: { id: topicId },
    data: {
      ...(title ? { title: title.slice(0, 200) } : {}),
      ...(input.archived === undefined ? {} : { archivedAt: input.archived ? new Date() : null }),
    },
    select: { id: true, slug: true, title: true, archivedAt: true },
  });
  publishAppChange("research", [topicId]);
  return { ...topic, archivedAt: topic.archivedAt?.toISOString() ?? null };
};
