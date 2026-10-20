import { action } from "@solidjs/router";
import { z } from "zod";
import { prisma } from "~/server/db";
import { redoBatch, undoBatch } from "./research.ingest";
import { createTopic } from "./research.store";
import { RESEARCH_CARD_STATES } from "./research.types";

const idString = z.string().min(1);

export const createResearchTopic = action(async (payload: { title: string }) => {
  "use server";
  const input = z.object({ title: z.string().trim().min(1).max(200) }).parse(payload);
  return createTopic(input);
}, "research-topic-create");

export const renameResearchTopic = action(async (payload: { id: string; title: string }) => {
  "use server";
  const input = z.object({ id: idString, title: z.string().trim().min(1).max(200) }).parse(payload);
  await prisma.researchTopic.update({ where: { id: input.id }, data: { title: input.title } });
  return { ok: true };
}, "research-topic-rename");

export const setResearchTopicArchived = action(async (payload: { id: string; archived: boolean }) => {
  "use server";
  const input = z.object({ id: idString, archived: z.boolean() }).parse(payload);
  await prisma.researchTopic.update({
    where: { id: input.id },
    data: { archivedAt: input.archived ? new Date() : null },
  });
  return { ok: true };
}, "research-topic-archive");

export const undoResearchBatch = action(async (payload: { batchId: string }) => {
  "use server";
  return undoBatch(z.object({ batchId: idString }).parse(payload).batchId);
}, "research-batch-undo");

export const redoResearchBatch = action(async (payload: { batchId: string }) => {
  "use server";
  return redoBatch(z.object({ batchId: idString }).parse(payload).batchId);
}, "research-batch-redo");

/** Your own state edits are direct (not batches); agents go through setCardStates. */
export const setResearchCardState = action(
  async (payload: { id: string; state: (typeof RESEARCH_CARD_STATES)[number] }) => {
    "use server";
    const input = z.object({ id: idString, state: z.enum(RESEARCH_CARD_STATES) }).parse(payload);
    const card = await prisma.researchCard.findUnique({ where: { id: input.id }, select: { type: true } });
    if (!card || (card.type !== "task" && card.type !== "question")) {
      throw new Error("Only tasks and questions have a state");
    }
    await prisma.researchCard.update({ where: { id: input.id }, data: { state: input.state } });
    return { ok: true };
  },
  "research-card-state",
);

/** Accept or un-accept a summary draft. Only accepted groups fold on the canvas. */
export const setResearchSummaryStatus = action(
  async (payload: { groupId: string; status: "draft" | "accepted" }) => {
    "use server";
    const input = z.object({ groupId: idString, status: z.enum(["draft", "accepted"]) }).parse(payload);
    await prisma.researchSummaryGroup.update({ where: { id: input.groupId }, data: { status: input.status } });
    return { ok: true };
  },
  "research-summary-status",
);

/** Edit a summary's text; editing a draft also accepts it (you have reviewed it). */
export const updateResearchSummary = action(
  async (payload: { groupId: string; title: string; body: string }) => {
    "use server";
    const input = z
      .object({ groupId: idString, title: z.string().trim().min(1).max(300), body: z.string().max(20_000) })
      .parse(payload);
    const group = await prisma.researchSummaryGroup.findUniqueOrThrow({ where: { id: input.groupId } });
    await prisma.$transaction([
      prisma.researchCard.update({
        where: { id: group.summaryCardId },
        data: { title: input.title, body: input.body },
      }),
      prisma.researchSummaryGroup.update({ where: { id: group.id }, data: { status: "accepted" } }),
    ]);
    return { ok: true };
  },
  "research-summary-update",
);

/** Discard hides the summary card (soft, like every other removal). */
export const discardResearchSummary = action(async (payload: { groupId: string }) => {
  "use server";
  const input = z.object({ groupId: idString }).parse(payload);
  const group = await prisma.researchSummaryGroup.findUniqueOrThrow({ where: { id: input.groupId } });
  await prisma.researchCard.update({ where: { id: group.summaryCardId }, data: { hiddenAt: new Date() } });
  return { ok: true };
}, "research-summary-discard");

/** Persist a dragged card's offset from its computed layout position. */
export const setResearchCardNudge = action(
  async (payload: { id: string; x: number | null; y: number | null }) => {
    "use server";
    const coord = z.number().finite().min(-100_000).max(100_000).nullable();
    const input = z.object({ id: idString, x: coord, y: coord }).parse(payload);
    await prisma.researchCard.update({ where: { id: input.id }, data: { nudgeX: input.x, nudgeY: input.y } });
    return { ok: true };
  },
  "research-card-nudge",
);
