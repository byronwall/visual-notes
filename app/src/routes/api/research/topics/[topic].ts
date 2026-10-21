import type { APIEvent } from "@solidjs/start/server";
import { researchJson } from "~/server/lib/research/auth";
import { loadTopicGraph } from "~/services/research/research.store";

export async function GET(event: APIEvent) {
  const graph = await loadTopicGraph(event.params.topic);
  return graph ? researchJson(graph) : researchJson({ error: "Topic not found" }, 404);
}
