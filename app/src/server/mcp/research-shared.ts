import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  batchPayload,
  logResearchEvent,
} from "~/services/research/research.activity";
import type { IngestResult } from "~/services/research/research.ingest";
import {
  loadTopicGraph,
  resolveTopic,
} from "~/services/research/research.store";
import {
  agentContext,
  appLink,
  ConnectorError,
  type ConnectorContext,
} from "./shared";

// What the research tool files share: argument shapes, topic lookup, and the
// one path every card write takes into an undoable, logged batch.

export type Topic = { id: string; slug: string; title: string };

export const topicArg = z
  .string()
  .min(1)
  .describe("Topic id or slug (from research_list_topics)");
export const agentArg = z
  .string()
  .max(100)
  .optional()
  .describe(
    'Who is writing, shown in topic history, e.g. "claude-code". Defaults to the connected client.',
  );
export const batchKeyArg = z
  .string()
  .max(200)
  .optional()
  .describe(
    "Idempotency key. Reuse it when retrying the same write; omit for a fresh one.",
  );

export const topicAppUrl = (ctx: ConnectorContext, slug: string) =>
  appLink(ctx, `/research/${slug}`);

const noTopic = (topic: string) =>
  new ConnectorError(
    "not_found",
    `No topic "${topic}". Use research_list_topics.`,
  );

export async function requireTopic(topic: string): Promise<Topic> {
  const found = await resolveTopic(topic);
  if (!found) throw noTopic(topic);
  return found;
}

export async function requireGraph(topic: string) {
  const graph = await loadTopicGraph(topic);
  if (!graph) throw noTopic(topic);
  return graph;
}

type BatchWrite = {
  topic: string;
  agent?: string;
  batchKey?: string;
  /** What the history shows: ingest, state, edit, or remove. */
  kind: string;
  /** Cards touched, for the activity line; defaults to the cards added. */
  cardCount?: number;
  summary?: string;
};

/**
 * Runs one card write as a batch: resolves the topic, names the writer,
 * fills in a batch key, and logs the batch unless it was a replay.
 */
export async function writeBatch(
  ctx: ConnectorContext,
  input: BatchWrite,
  work: (
    topicId: string,
    batch: { agent: string; batchKey: string },
  ) => Promise<IngestResult>,
) {
  const topic = await requireTopic(input.topic);
  const agent = input.agent?.trim() || ctx.actorId;
  const result = await work(topic.id, {
    agent,
    batchKey: input.batchKey || randomUUID(),
  });
  if (!result.replayed) {
    await logResearchEvent(
      "research.batch_added",
      topic,
      batchPayload(
        { ...result, cardCount: input.cardCount ?? result.cardCount },
        { agent, kind: input.kind, summary: input.summary },
      ),
      agentContext(ctx),
    );
  }
  return { ...result, appUrl: topicAppUrl(ctx, topic.slug) };
}
