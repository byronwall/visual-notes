import type { APIEvent } from "@solidjs/start/server";
import { researchJson } from "~/server/lib/research/auth";
import { ingestTree, ResearchIngestError } from "~/services/research/research.ingest";
import { resolveTopic } from "~/services/research/research.store";
import { batchPayload, logResearchEvent } from "~/services/research/research.activity";

export async function POST(event: APIEvent) {
  const topic = await resolveTopic(event.params.topic);
  if (!topic) return researchJson({ error: "Topic not found" }, 404);
  const body = await event.request.json().catch(() => undefined);
  try {
    const result = await ingestTree(topic.id, body);
    if (!result.replayed) {
      const agent = String((body as { agent?: unknown } | undefined)?.agent ?? "agent");
      await logResearchEvent("research.batch_added", topic, batchPayload(result, { agent, kind: "ingest" }), {
        actorId: `research-api:${agent}`,
        actorType: "system",
      });
    }
    return researchJson(result);
  } catch (error) {
    if (error instanceof ResearchIngestError) {
      return researchJson({ error: "Invalid payload", issues: error.issues }, 400);
    }
    console.error("[research-ingest] failed", error);
    return researchJson({ error: "Ingest failed" }, 500);
  }
}
