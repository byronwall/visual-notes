import { z } from "zod";
import { researchJson } from "~/server/lib/research/auth";
import { createTopic, listTopics } from "~/services/research/research.store";
import { logResearchEvent } from "~/services/research/research.activity";

export async function GET() {
  return researchJson({ topics: await listTopics() });
}

export async function POST(event: { request: Request }) {
  const parsed = z
    .object({ title: z.string().trim().min(1).max(200), slug: z.string().trim().max(80).optional() })
    .safeParse(await event.request.json().catch(() => null));
  if (!parsed.success) return researchJson({ error: "Expected { title, slug? }" }, 400);
  const topic = await createTopic(parsed.data);
  await logResearchEvent("research.topic_created", topic, {}, { actorId: "research-api", actorType: "system" });
  return researchJson(topic, 201);
}
