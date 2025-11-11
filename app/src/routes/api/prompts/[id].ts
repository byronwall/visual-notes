import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";

export async function GET(event: APIEvent) {
  const id = event.params.id!;
  const prompt = await prisma.prompt.findUnique({
    where: { id },
    include: {
      activeVersion: true,
      versions: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!prompt) return json({ error: "Not found" }, { status: 404 });
  console.log(`[api/prompts/:id] GET id=${id}`);
  return json({ item: prompt });
}


