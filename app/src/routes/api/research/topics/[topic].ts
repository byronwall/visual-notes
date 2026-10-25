import type { APIEvent } from "@solidjs/start/server";
import { researchJson } from "~/server/lib/research/auth";
import {
  batchPayload,
  logResearchEvent,
} from "~/services/research/research.activity";
import { ResearchIngestError } from "~/services/research/research.ingest";
import { setupTopic } from "~/services/research/research.setup";
import {
  loadTopicGraph,
  resolveTopic,
} from "~/services/research/research.store";

export async function GET(event: APIEvent) {
  const graph = await loadTopicGraph(event.params.topic);
  return graph
    ? researchJson(graph)
    : researchJson({ error: "Topic not found" }, 404);
}

/** Set a topic's streams, kinds, and answer as one undoable batch. */
export async function PATCH(event: APIEvent) {
  const topic = await resolveTopic(event.params.topic);
  if (!topic) return researchJson({ error: "Topic not found" }, 404);
  const body = (await event.request.json().catch(() => undefined)) as
    | { agent?: unknown }
    | undefined;
  try {
    const result = await setupTopic(
      topic.id,
      body as Parameters<typeof setupTopic>[1],
    );
    if (!result.replayed) {
      const agent = String(body?.agent ?? "agent");
      await logResearchEvent(
        "research.batch_added",
        topic,
        batchPayload(result, { agent, kind: "setup" }),
        {
          actorId: `research-api:${agent}`,
          actorType: "system",
        },
      );
    }
    return researchJson(result);
  } catch (error) {
    if (error instanceof ResearchIngestError) {
      return researchJson(
        { error: "Invalid setup", issues: error.issues },
        400,
      );
    }
    console.error("[research-setup] failed", error);
    return researchJson({ error: "Setup failed" }, 500);
  }
}
