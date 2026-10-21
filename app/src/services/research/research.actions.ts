import { action } from "@solidjs/router";
import { z } from "zod";
import { prisma } from "~/server/db";
import { publishAppChange } from "~/server/note-events";
import { randomUUID } from "node:crypto";
import { editCards, removeCards, updateTopic } from "./research.edits";
import { redoBatch, undoBatch } from "./research.ingest";
import { batchPayload, logResearchEvent, logUndoRedo } from "./research.activity";
import { createTopic } from "./research.store";
import { RESEARCH_CARD_STATES } from "./research.types";

const idString = z.string().min(1);

const topicById = (id: string) =>
  prisma.researchTopic.findUniqueOrThrow({ where: { id }, select: { id: true, slug: true, title: true } });


export const createResearchTopic = action(async (payload: { title: string }) => {
  "use server";
  const input = z.object({ title: z.string().trim().min(1).max(200) }).parse(payload);
  const topic = await createTopic(input);
  await logResearchEvent("research.topic_created", topic);
  return topic;
}, "research-topic-create");

export const renameResearchTopic = action(async (payload: { id: string; title: string }) => {
  "use server";
  const input = z.object({ id: idString, title: z.string().trim().min(1).max(200) }).parse(payload);
  const topic = await updateTopic(input.id, { title: input.title });
  await logResearchEvent("research.topic_updated", topic, { change: "renamed" });
  return { ok: true };
}, "research-topic-rename");

export const setResearchTopicArchived = action(async (payload: { id: string; archived: boolean }) => {
  "use server";
  const input = z.object({ id: idString, archived: z.boolean() }).parse(payload);
  const topic = await updateTopic(input.id, { archived: input.archived });
  await logResearchEvent("research.topic_updated", topic, { change: input.archived ? "archived" : "unarchived" });
  return { ok: true };
}, "research-topic-archive");

/** Your card edits are batches too, so they show in history and undo. */
export const editResearchCard = action(
  async (payload: { topicId: string; id: string; title: string; body: string; url?: string | null }) => {
    "use server";
    const input = z
      .object({
        topicId: idString,
        id: idString,
        title: z.string().trim().min(1).max(300),
        body: z.string().max(20_000),
        url: z.string().max(2000).nullish(),
      })
      .parse(payload);
    const { topicId, ...edit } = input;
    const result = await editCards(topicId, { batchKey: randomUUID(), agent: "you", edits: [edit] });
    await logResearchEvent(
      "research.batch_added",
      await topicById(topicId),
      batchPayload(result, { agent: "you", kind: "edit", summary: edit.title }),
    );
    return result;
  },
  "research-card-edit",
);

/** Remove a card (and anything under it) as an undoable batch. */
export const removeResearchCards = action(async (payload: { topicId: string; ids: string[] }) => {
  "use server";
  const input = z.object({ topicId: idString, ids: z.array(idString).min(1).max(500) }).parse(payload);
  const result = await removeCards(input.topicId, { batchKey: randomUUID(), agent: "you", ids: input.ids });
  await logResearchEvent(
    "research.batch_added",
    await topicById(input.topicId),
    batchPayload({ ...result, cardCount: input.ids.length }, { agent: "you", kind: "remove" }),
  );
  return result;
}, "research-card-remove");

export const undoResearchBatch = action(async (payload: { batchId: string }) => {
  "use server";
  const { batchId } = z.object({ batchId: idString }).parse(payload);
  const result = await undoBatch(batchId);
  if (result.ok) await logUndoRedo(batchId, "research.batch_undone");
  return result;
}, "research-batch-undo");

export const redoResearchBatch = action(async (payload: { batchId: string }) => {
  "use server";
  const { batchId } = z.object({ batchId: idString }).parse(payload);
  const result = await redoBatch(batchId);
  if (result.ok) await logUndoRedo(batchId, "research.batch_redone");
  return result;
}, "research-batch-redo");

/** Your own state edits are direct (not batches); agents go through setCardStates. */
export const setResearchCardState = action(
  async (payload: { id: string; state: (typeof RESEARCH_CARD_STATES)[number] }) => {
    "use server";
    const input = z.object({ id: idString, state: z.enum(RESEARCH_CARD_STATES) }).parse(payload);
    const card = await prisma.researchCard.findUnique({ where: { id: input.id }, select: { type: true, topicId: true } });
    if (!card || (card.type !== "task" && card.type !== "question")) {
      throw new Error("Only tasks and questions have a state");
    }
    await prisma.researchCard.update({ where: { id: input.id }, data: { state: input.state } });
    publishAppChange("research", [card.topicId]);
    return { ok: true };
  },
  "research-card-state",
);

/** Accept or un-accept a summary draft. Only accepted groups fold on the canvas. */
export const setResearchSummaryStatus = action(
  async (payload: { groupId: string; status: "draft" | "accepted" }) => {
    "use server";
    const input = z.object({ groupId: idString, status: z.enum(["draft", "accepted"]) }).parse(payload);
    const group = await prisma.researchSummaryGroup.update({
      where: { id: input.groupId },
      data: { status: input.status },
      select: { topicId: true },
    });
    publishAppChange("research", [group.topicId]);
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
    publishAppChange("research", [group.topicId]);
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
  publishAppChange("research", [group.topicId]);
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
