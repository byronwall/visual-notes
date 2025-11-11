import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";

export async function GET(event: APIEvent) {
  const id = event.params.id!;
  const run = await prisma.promptRun.findUnique({
    where: { id },
    include: {
      promptVersion: {
        include: {
          Prompt: { select: { id: true, task: true, defaultModel: true } },
        },
      },
      HumanFeedback: true,
    },
  });
  if (!run) return json({ error: "Not found" }, { status: 404 });
  console.log(`[api/ai/runs/:id] GET id=${id}`);
  return json({ item: run });
}


