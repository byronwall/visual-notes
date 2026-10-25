import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import { publishAppChange } from "~/server/note-events";
import {
  lintWrite,
  ResearchIngestError,
  type IngestResult,
} from "./research.ingest";
import { parseKinds } from "./research.kinds";
import { normalizeFields } from "./research.plan";

// Card edits and removals as undoable batches, for agents and the canvas
// alike. A batch's `result` keeps the before/after values, so undo can put
// them back and redo can apply them again.

type Tx = Prisma.TransactionClient;

const EDITABLE_CARD_FIELDS = [
  "title",
  "gist",
  "body",
  "url",
  "snippet",
  "imageUrl",
] as const;
export type CardFields = {
  title?: string;
  gist?: string;
  body?: string;
  url?: string | null;
  snippet?: string | null;
  imageUrl?: string | null;
  kind?: string | null;
  fields?: Record<string, string> | null;
  streamId?: string | null;
  parentId?: string | null;
};

/** What callers may send: a stream by key and fields as loose values. */
export type CardEditInput = Omit<CardFields, "streamId" | "fields"> & {
  id: string;
  stream?: string | null;
  fields?: Record<string, string | number | boolean | null> | null;
};

export type CardEdit = { id: string; before: CardFields; after: CardFields };

type StreamFields = {
  title?: string;
  goal?: string;
  answer?: string;
  sortOrder?: number;
};
export type StreamEdit = {
  id: string;
  before: StreamFields;
  after: StreamFields;
};
type TopicFields = { answer?: string; kinds?: unknown };
export type TopicEdit = { before: TopicFields; after: TopicFields };

/** What an edit, removal, or topic-setup batch stores in `ResearchBatch.result`. */
export type EditEffects = {
  cardEdits?: CardEdit[];
  removedIds?: string[];
  streamEdits?: StreamEdit[];
  removedStreamIds?: string[];
  /** Streams a setup brought back from removal. */
  restoredStreamIds?: string[];
  topicEdit?: TopicEdit;
  /** Set with topicEdit, so undo can find the topic without a card. */
  topicId?: string;
};

type BatchInput = { batchKey: string; agent: string };

const emptyCounts = { refs: {}, cardCount: 0, linkCount: 0, summaryCount: 0 };

// JSON columns compare by value; key order is stable because we write it.
const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const sameFields = (
  current: Record<string, unknown>,
  fields: Record<string, unknown>,
) =>
  Object.entries(fields).every(([key, value]) =>
    sameValue(current[key], value),
  );

/** Prisma wants DbNull, not null, to clear a JSON column. */
const cardData = (
  fields: CardFields,
): Prisma.ResearchCardUncheckedUpdateInput => {
  const { fields: values, ...rest } = fields;
  return "fields" in fields
    ? { ...rest, fields: values ?? Prisma.DbNull }
    : rest;
};

const cleanFields = (
  input: Record<string, string | null | undefined>,
): CardFields => {
  const out: CardFields = {};
  for (const field of EDITABLE_CARD_FIELDS) {
    if (!(field in input) || input[field] === undefined) continue;
    const value = input[field];
    if (field === "title") {
      const title = String(value ?? "").trim();
      if (title) out.title = title.slice(0, 300);
    } else if (field === "body") {
      out.body = String(value ?? "").slice(0, 20_000);
    } else if (field === "gist") {
      out.gist = String(value ?? "")
        .trim()
        .slice(0, 600);
    } else {
      out[field] =
        value === null || String(value).trim() === ""
          ? null
          : String(value).trim();
    }
  }
  return out;
};

async function existingBatch(
  topicId: string,
  batchKey: string,
): Promise<IngestResult | null> {
  const batch = await prisma.researchBatch.findUnique({
    where: { topicId_batchKey: { topicId, batchKey } },
  });
  return batch
    ? { batchId: batch.id, batchKey, replayed: true, ...emptyCounts }
    : null;
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
      result: {
        ...emptyCounts,
        ...effects,
      } as unknown as Prisma.InputJsonValue,
    },
  });
  await tx.researchTopic.update({
    where: { id: topicId },
    data: { updatedAt: new Date() },
  });
  return { batchId, batchKey: input.batchKey, replayed: false, ...emptyCounts };
}

const plural = (count: number, one: string) =>
  `${count} ${one}${count === 1 ? "" : "s"}`;

/** Change card text, kind, fields, stream, or parent as one undoable batch. */
export const editCards = async (
  topicId: string,
  input: BatchInput & { edits: CardEditInput[] },
): Promise<IngestResult> => {
  const replayed = await existingBatch(topicId, input.batchKey);
  if (replayed) return replayed;
  const result = await prisma.$transaction(async (tx) => {
    const [cards, allCards, streams, topic] = await Promise.all([
      tx.researchCard.findMany({
        where: {
          topicId,
          hiddenAt: null,
          id: { in: input.edits.map((edit) => edit.id) },
        },
      }),
      tx.researchCard.findMany({
        where: { topicId, hiddenAt: null },
        select: { id: true, parentId: true },
      }),
      tx.researchStream.findMany({
        where: { topicId, hiddenAt: null },
        select: { id: true, key: true },
      }),
      tx.researchTopic.findUniqueOrThrow({
        where: { id: topicId },
        select: { kinds: true },
      }),
    ]);
    const byId = new Map(cards.map((card) => [card.id, card]));
    const parentOf = new Map(allCards.map((card) => [card.id, card.parentId]));
    const streamByKey = new Map(
      streams.map((stream) => [stream.key, stream.id]),
    );
    const kinds = new Map(
      parseKinds(topic.kinds).map((kind) => [kind.key, kind]),
    );
    const issues: string[] = [];
    const edits: CardEdit[] = [];
    for (const { id, stream, fields, kind, parentId, ...text } of input.edits) {
      const card = byId.get(id);
      if (!card) {
        issues.push(`no card "${id}" in this topic`);
        continue;
      }
      const after = cleanFields(text);
      if (kind !== undefined) {
        const declared = kind ? kinds.get(kind) : null;
        if (kind && !declared)
          issues.push(
            `edit for "${id}": unknown kind "${kind}" (declared: ${[...kinds.keys()].join(", ") || "none"})`,
          );
        else if (declared && declared.role !== card.type)
          issues.push(
            `edit for "${id}": kind "${kind}" is a ${declared.role}, not a ${card.type}`,
          );
        else after.kind = kind || null;
      }
      if (stream !== undefined) {
        const streamId = stream ? streamByKey.get(stream) : null;
        if (stream && !streamId)
          issues.push(
            `edit for "${id}": unknown stream "${stream}" (declared: ${[...streamByKey.keys()].join(", ") || "none"})`,
          );
        else after.streamId = streamId ?? null;
      }
      if (fields !== undefined)
        after.fields = normalizeFields(fields ?? undefined);
      if (parentId !== undefined) {
        if (parentId === id)
          issues.push(`edit for "${id}": a card cannot come from itself`);
        else if (parentId && !parentOf.has(parentId))
          issues.push(`edit for "${id}": no card "${parentId}" to move under`);
        else {
          // Moving under one of its own descendants would make a loop.
          let cursor = parentId;
          const seen = new Set<string>();
          while (cursor && !seen.has(cursor) && cursor !== id) {
            seen.add(cursor);
            cursor = parentOf.get(cursor) ?? null;
          }
          if (cursor === id)
            issues.push(
              `edit for "${id}": "${parentId}" is below it; move that card first`,
            );
          else after.parentId = parentId;
        }
      }
      if (!Object.keys(after).length) {
        issues.push(`edit for "${id}" changes nothing (title cannot be empty)`);
        continue;
      }
      const current = card as unknown as Record<string, unknown>;
      const before = Object.fromEntries(
        Object.keys(after).map((key) => [key, current[key] ?? null]),
      ) as CardFields;
      if (!sameFields(current, after)) edits.push({ id, before, after });
    }
    if (issues.length) throw new ResearchIngestError(issues);
    if (!edits.length)
      throw new ResearchIngestError(["every edit matches the card already"]);
    for (const edit of edits) {
      await tx.researchCard.update({
        where: { id: edit.id },
        data: cardData(edit.after),
      });
    }
    const only = edits.length === 1 ? byId.get(edits[0].id) : null;
    const summary = only
      ? `Edited “${edits[0].after.title ?? only.title}”`
      : `Edited ${plural(edits.length, "card")}`;
    return createBatch(tx, topicId, input, summary, { cardEdits: edits });
  });
  publishAppChange("research", [topicId]);
  return {
    ...result,
    warnings: await lintWrite(
      topicId,
      input.edits.map((edit) => edit.id),
    ),
  };
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
    const issues = ids
      .filter((id) => !found.has(id))
      .map((id) => `no card "${id}" in this topic`);
    const children = await tx.researchCard.findMany({
      where: { parentId: { in: ids }, hiddenAt: null, id: { notIn: ids } },
      select: { id: true, parentId: true },
    });
    for (const child of children) {
      issues.push(
        `card "${child.parentId}" still has child "${child.id}"; remove it too or move on`,
      );
    }
    if (issues.length) throw new ResearchIngestError(issues);
    await tx.researchCard.updateMany({
      where: { id: { in: ids } },
      data: { hiddenAt: new Date() },
    });
    const summary =
      cards.length === 1
        ? `Removed “${cards[0].title}”`
        : `Removed ${plural(cards.length, "card")}`;
    return createBatch(tx, topicId, input, summary, { removedIds: ids });
  });
  publishAppChange("research", [topicId]);
  return result;
};

/**
 * Reverts a batch's edits and removals inside undo. Returns a reason when a
 * card changed after this batch, so the older undo would clobber it.
 */
export async function revertEffects(
  tx: Tx,
  effects: EditEffects,
): Promise<string | null> {
  const edits = effects.cardEdits ?? [];
  if (edits.length) {
    const cards = await tx.researchCard.findMany({
      where: { id: { in: edits.map((e) => e.id) } },
    });
    const byId = new Map(
      cards.map((card) => [card.id, card as Record<string, unknown>]),
    );
    if (
      edits.some(
        (edit) =>
          !byId.has(edit.id) || !sameFields(byId.get(edit.id)!, edit.after),
      )
    ) {
      return "A card in this batch was edited again later; undo that edit first.";
    }
    for (const edit of edits)
      await tx.researchCard.update({
        where: { id: edit.id },
        data: cardData(edit.before),
      });
  }
  const streamEdits = effects.streamEdits ?? [];
  if (streamEdits.length) {
    const streams = await tx.researchStream.findMany({
      where: { id: { in: streamEdits.map((e) => e.id) } },
    });
    const byId = new Map(
      streams.map((stream) => [
        stream.id,
        stream as unknown as Record<string, unknown>,
      ]),
    );
    if (
      streamEdits.some(
        (edit) =>
          !byId.has(edit.id) || !sameFields(byId.get(edit.id)!, edit.after),
      )
    ) {
      return "A stream in this batch was changed again later; undo that change first.";
    }
    for (const edit of streamEdits)
      await tx.researchStream.update({
        where: { id: edit.id },
        data: edit.before,
      });
  }
  if (effects.topicEdit) {
    const topicId = effects.topicId;
    if (topicId) {
      const topic = (await tx.researchTopic.findUnique({
        where: { id: topicId },
      })) as unknown as Record<string, unknown>;
      if (!topic || !sameFields(topic, effects.topicEdit.after)) {
        return "The topic answer or kinds changed again later; undo that change first.";
      }
      await tx.researchTopic.update({
        where: { id: topicId },
        data: topicData(effects.topicEdit.before),
      });
    }
  }
  if (effects.removedStreamIds?.length) {
    await tx.researchStream.updateMany({
      where: { id: { in: effects.removedStreamIds } },
      data: { hiddenAt: null },
    });
  }
  if (effects.restoredStreamIds?.length) {
    await tx.researchStream.updateMany({
      where: { id: { in: effects.restoredStreamIds } },
      data: { hiddenAt: new Date() },
    });
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
export async function reapplyEffects(
  tx: Tx,
  effects: EditEffects,
): Promise<void> {
  for (const edit of effects.cardEdits ?? []) {
    await tx.researchCard.update({
      where: { id: edit.id },
      data: cardData(edit.after),
    });
  }
  for (const edit of effects.streamEdits ?? []) {
    await tx.researchStream.update({
      where: { id: edit.id },
      data: edit.after,
    });
  }
  if (effects.topicEdit) {
    const topicId = effects.topicId;
    if (topicId)
      await tx.researchTopic.update({
        where: { id: topicId },
        data: topicData(effects.topicEdit.after),
      });
  }
  if (effects.removedStreamIds?.length) {
    await tx.researchStream.updateMany({
      where: { id: { in: effects.removedStreamIds } },
      data: { hiddenAt: new Date() },
    });
  }
  if (effects.restoredStreamIds?.length) {
    await tx.researchStream.updateMany({
      where: { id: { in: effects.restoredStreamIds } },
      data: { hiddenAt: null },
    });
  }
  if (effects.removedIds?.length) {
    await tx.researchCard.updateMany({
      where: { id: { in: effects.removedIds } },
      data: { hiddenAt: new Date() },
    });
  }
}

const topicData = (
  fields: TopicFields,
): Prisma.ResearchTopicUncheckedUpdateInput => ({
  ...(fields.answer === undefined ? {} : { answer: fields.answer }),
  ...("kinds" in fields
    ? { kinds: (fields.kinds ?? []) as Prisma.InputJsonValue }
    : {}),
});

/** Rename and/or archive a topic. */
export const updateTopic = async (
  topicId: string,
  input: { title?: string; archived?: boolean },
): Promise<{
  id: string;
  slug: string;
  title: string;
  archivedAt: string | null;
}> => {
  const title = input.title?.trim();
  if (input.title !== undefined && !title)
    throw new ResearchIngestError(["title cannot be empty"]);
  if (title === undefined && input.archived === undefined) {
    throw new ResearchIngestError(["pass title and/or archived"]);
  }
  const topic = await prisma.researchTopic.update({
    where: { id: topicId },
    data: {
      ...(title ? { title: title.slice(0, 200) } : {}),
      ...(input.archived === undefined
        ? {}
        : { archivedAt: input.archived ? new Date() : null }),
    },
    select: { id: true, slug: true, title: true, archivedAt: true },
  });
  publishAppChange("research", [topicId]);
  return { ...topic, archivedAt: topic.archivedAt?.toISOString() ?? null };
};
