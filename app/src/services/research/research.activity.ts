import { prisma } from "~/server/db";
import { logActionEvent, type LogActionEventInput } from "~/server/events/action-events";

// Research writes in the activity timeline. Every event points at the topic
// (`entityType: "research_topic"`) and carries enough to describe it without
// another read.

export type ResearchEventType =
  | "research.topic_created"
  | "research.topic_updated"
  | "research.batch_added"
  | "research.batch_undone"
  | "research.batch_redone";

type Topic = { id: string; slug: string; title: string };

export const logResearchEvent = (
  eventType: ResearchEventType,
  topic: Topic,
  payload: Record<string, string | number | boolean | null> = {},
  context?: LogActionEventInput["context"],
) =>
  logActionEvent({
    eventType,
    entityType: "research_topic",
    entityId: topic.id,
    payload: { topicTitle: topic.title, topicSlug: topic.slug, ...payload },
    context,
  });

/** Payload fields for a batch event, from an ingest/edit result. */
export const batchPayload = (
  result: { batchId: string; batchKey: string; replayed?: boolean; cardCount?: number },
  extra: { agent: string; summary?: string | null; kind: string },
) => ({
  batchId: result.batchId,
  batchKey: result.batchKey,
  cardCount: result.cardCount ?? 0,
  agent: extra.agent,
  kind: extra.kind,
  summary: extra.summary ?? null,
});

/** Logs an undo or redo, naming the batch and its topic. */
export const logUndoRedo = async (
  batchId: string,
  eventType: "research.batch_undone" | "research.batch_redone",
  context?: LogActionEventInput["context"],
) => {
  const batch = await prisma.researchBatch.findUnique({
    where: { id: batchId },
    select: { batchKey: true, agent: true, summary: true, topic: { select: { id: true, slug: true, title: true } } },
  });
  if (!batch) return;
  await logResearchEvent(eventType, batch.topic, {
    batchId,
    batchKey: batch.batchKey,
    agent: batch.agent,
    summary: batch.summary || null,
  }, context);
};
