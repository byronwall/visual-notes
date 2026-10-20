import type { APIEvent } from "@solidjs/start/server";
import { researchJson } from "~/server/lib/research/auth";
import { ingestTree, ResearchIngestError } from "~/services/research/research.ingest";
import { resolveTopic } from "~/services/research/research.store";

export async function POST(event: APIEvent) {
  const topic = await resolveTopic(event.params.topic);
  if (!topic) return researchJson({ error: "Topic not found" }, 404);
  const body = await event.request.json().catch(() => undefined);
  try {
    return researchJson(await ingestTree(topic.id, body));
  } catch (error) {
    if (error instanceof ResearchIngestError) {
      return researchJson({ error: "Invalid payload", issues: error.issues }, 400);
    }
    console.error("[research-ingest] failed", error);
    return researchJson({ error: "Ingest failed" }, 500);
  }
}
