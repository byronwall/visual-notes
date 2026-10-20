import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import {
  formatPayloadError,
  ingestPayloadSchema,
  type IngestPayloadInput,
} from "./research.payload";
import { planIngest } from "./research.plan";
import type { ResearchCardState } from "./research.types";

export class ResearchIngestError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join("\n"));
    this.name = "ResearchIngestError";
  }
}

export type IngestResult = {
  batchId: string;
  batchKey: string;
  /** True when this batchKey was already applied and the stored result is returned. */
  replayed: boolean;
  refs: Record<string, string>;
  cardCount: number;
  linkCount: number;
  summaryCount: number;
};

type StoredResult = Omit<IngestResult, "replayed" | "batchId" | "batchKey"> & {
  stateChanges?: StateChange[];
};

type StateChange = { id: string; from: ResearchCardState | null; to: ResearchCardState };

const newId = () => randomUUID();

const replay = (batch: { id: string; batchKey: string; result: Prisma.JsonValue }): IngestResult => {
  const stored = (batch.result ?? {}) as Partial<StoredResult>;
  return {
    batchId: batch.id,
    batchKey: batch.batchKey,
    replayed: true,
    refs: stored.refs ?? {},
    cardCount: stored.cardCount ?? 0,
    linkCount: stored.linkCount ?? 0,
    summaryCount: stored.summaryCount ?? 0,
  };
};

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/**
 * Apply one ingest payload as a single batch: all cards, links, and summary
 * drafts land together or not at all. Retrying a batchKey is a no-op.
 */
export const ingestTree = async (topicId: string, rawPayload: unknown): Promise<IngestResult> => {
  const parsed = ingestPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) throw new ResearchIngestError(formatPayloadError(parsed.error));
  const payload = parsed.data;
  const started = Date.now();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const topic = await tx.researchTopic.findUnique({ where: { id: topicId }, select: { id: true } });
      if (!topic) throw new ResearchIngestError([`topic "${topicId}" not found`]);

      const existingBatch = await tx.researchBatch.findUnique({
        where: { topicId_batchKey: { topicId, batchKey: payload.batchKey } },
      });
      if (existingBatch) return replay(existingBatch);

      const visible = await tx.researchCard.findMany({
        where: { topicId, hiddenAt: null },
        select: { id: true },
      });
      const planned = planIngest(payload, {
        existingIds: new Set(visible.map((card) => card.id)),
        newId,
      });
      if (!planned.ok) throw new ResearchIngestError(planned.errors);
      const { plan } = planned;

      const batchId = newId();
      const stored: StoredResult = {
        refs: plan.refs,
        cardCount: plan.cards.length,
        linkCount: plan.links.length,
        summaryCount: plan.summaries.length,
      };
      await tx.researchBatch.create({
        data: {
          id: batchId,
          topicId,
          batchKey: payload.batchKey,
          agent: payload.agent,
          summary: payload.summary ?? "",
          result: stored as unknown as Prisma.InputJsonValue,
        },
      });

      const allCards = [...plan.cards, ...plan.summaries.map((summary) => summary.card)];
      if (allCards.length) {
        await tx.researchCard.createMany({
          data: allCards.map((card) => ({ ...card, topicId, batchId })),
        });
      }
      if (plan.links.length) {
        await tx.researchLink.createMany({
          data: plan.links.map((link) => ({ ...link, topicId, batchId })),
        });
      }
      for (const summary of plan.summaries) {
        await tx.researchSummaryGroup.create({
          data: {
            id: summary.groupId,
            topicId,
            summaryCardId: summary.card.id,
            status: "draft",
            batchId,
            members: { createMany: { data: summary.memberIds.map((cardId) => ({ cardId })) } },
          },
        });
      }
      await tx.researchTopic.update({ where: { id: topicId }, data: { updatedAt: new Date() } });

      return { batchId, batchKey: payload.batchKey, replayed: false, ...stored };
    });
    console.info(
      `[research-ingest] topic=${topicId} batch=${result.batchKey} cards=${result.cardCount} links=${result.linkCount} summaries=${result.summaryCount} replayed=${result.replayed} ms=${Date.now() - started}`,
    );
    return result;
  } catch (error) {
    // Two concurrent retries of one batchKey: the loser returns the winner's result.
    if (isUniqueViolation(error)) {
      const batch = await prisma.researchBatch.findUnique({
        where: { topicId_batchKey: { topicId, batchKey: payload.batchKey } },
      });
      if (batch) return replay(batch);
    }
    if (error instanceof ResearchIngestError) {
      console.warn(`[research-ingest] rejected topic=${topicId} batch=${payload.batchKey}`, error.issues);
    }
    throw error;
  }
};

/** Change task/question states as one undoable batch. */
export const setCardStates = async (
  topicId: string,
  input: { batchKey: string; agent: string; changes: { id: string; state: ResearchCardState }[] },
): Promise<IngestResult> => {
  const existing = await prisma.researchBatch.findUnique({
    where: { topicId_batchKey: { topicId, batchKey: input.batchKey } },
  });
  if (existing) return replay(existing);

  return prisma.$transaction(async (tx) => {
    const cards = await tx.researchCard.findMany({
      where: { topicId, hiddenAt: null, id: { in: input.changes.map((change) => change.id) } },
      select: { id: true, type: true, state: true },
    });
    const byId = new Map(cards.map((card) => [card.id, card]));
    const issues: string[] = [];
    const stateChanges: StateChange[] = [];
    for (const change of input.changes) {
      const card = byId.get(change.id);
      if (!card) issues.push(`no card "${change.id}" in this topic`);
      else if (card.type !== "task" && card.type !== "question") {
        issues.push(`card "${change.id}" is a ${card.type}; only tasks and questions have state`);
      } else stateChanges.push({ id: card.id, from: card.state, to: change.state });
    }
    if (issues.length) throw new ResearchIngestError(issues);

    const batchId = newId();
    const stored: StoredResult = { refs: {}, cardCount: 0, linkCount: 0, summaryCount: 0, stateChanges };
    await tx.researchBatch.create({
      data: {
        id: batchId,
        topicId,
        batchKey: input.batchKey,
        agent: input.agent,
        summary: `Set state on ${stateChanges.length} card(s)`,
        result: stored as unknown as Prisma.InputJsonValue,
      },
    });
    for (const change of stateChanges) {
      await tx.researchCard.update({ where: { id: change.id }, data: { state: change.to } });
    }
    return { batchId, batchKey: input.batchKey, replayed: false, ...stored };
  });
};

export type UndoResult = { ok: true } | { ok: false; reason: string; blockingBatchIds: string[] };

/**
 * Hide everything a batch created (and revert its state changes). Refused when
 * a later, still-active batch built on top of it, so nothing is orphaned.
 */
export const undoBatch = async (batchId: string): Promise<UndoResult> =>
  prisma.$transaction(async (tx) => {
    const batch = await tx.researchBatch.findUnique({ where: { id: batchId } });
    if (!batch) return { ok: false, reason: "Batch not found", blockingBatchIds: [] };
    if (batch.undoneAt) return { ok: true };

    const ownCards = await tx.researchCard.findMany({ where: { batchId }, select: { id: true } });
    const ownIds = ownCards.map((card) => card.id);
    const activeOther = { batchId: { not: batchId }, batch: { undoneAt: null } };

    const [childCards, otherLinks, otherMemberships] = await Promise.all([
      tx.researchCard.findMany({
        where: { parentId: { in: ownIds }, hiddenAt: null, ...activeOther },
        select: { batchId: true },
      }),
      tx.researchLink.findMany({
        where: { hiddenAt: null, ...activeOther, OR: [{ fromId: { in: ownIds } }, { toId: { in: ownIds } }] },
        select: { batchId: true },
      }),
      tx.researchSummaryMember.findMany({
        where: { cardId: { in: ownIds }, group: { ...activeOther, summaryCard: { hiddenAt: null } } },
        select: { group: { select: { batchId: true } } },
      }),
    ]);
    const blocking = new Set<string>();
    for (const row of [...childCards, ...otherLinks]) if (row.batchId) blocking.add(row.batchId);
    for (const row of otherMemberships) if (row.group.batchId) blocking.add(row.group.batchId);
    if (blocking.size) {
      return {
        ok: false,
        reason: "Later batches build on this one; undo them first.",
        blockingBatchIds: [...blocking],
      };
    }

    const now = new Date();
    await tx.researchCard.updateMany({ where: { batchId }, data: { hiddenAt: now } });
    await tx.researchLink.updateMany({ where: { batchId }, data: { hiddenAt: now } });
    const stored = (batch.result ?? {}) as Partial<StoredResult>;
    for (const change of stored.stateChanges ?? []) {
      await tx.researchCard.update({ where: { id: change.id }, data: { state: change.from } });
    }
    await tx.researchBatch.update({ where: { id: batchId }, data: { undoneAt: now } });
    return { ok: true };
  });

/** Restore an undone batch, refusing if anything it hangs from is now hidden. */
export const redoBatch = async (batchId: string): Promise<UndoResult> =>
  prisma.$transaction(async (tx) => {
    const batch = await tx.researchBatch.findUnique({ where: { id: batchId } });
    if (!batch) return { ok: false, reason: "Batch not found", blockingBatchIds: [] };
    if (!batch.undoneAt) return { ok: true };

    const hiddenParents = await tx.researchCard.findMany({
      where: { batchId, parent: { hiddenAt: { not: null }, batchId: { not: batchId } } },
      select: { parent: { select: { batchId: true } } },
    });
    const blocking = [...new Set(hiddenParents.map((row) => row.parent?.batchId).filter(Boolean))] as string[];
    if (blocking.length) {
      return { ok: false, reason: "Redo the batches this one builds on first.", blockingBatchIds: blocking };
    }

    await tx.researchCard.updateMany({ where: { batchId }, data: { hiddenAt: null } });
    await tx.researchLink.updateMany({ where: { batchId }, data: { hiddenAt: null } });
    const stored = (batch.result ?? {}) as Partial<StoredResult>;
    for (const change of stored.stateChanges ?? []) {
      await tx.researchCard.update({ where: { id: change.id }, data: { state: change.to } });
    }
    await tx.researchBatch.update({ where: { id: batchId }, data: { undoneAt: null } });
    return { ok: true };
  });

export type { IngestPayloadInput };
