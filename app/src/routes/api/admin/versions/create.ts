import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "@solid-mediakit/auth";
import { authOptions } from "~/server/auth";
import { prisma } from "~/server/db";

export async function POST(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  const body = await event.request.json().catch(() => null);
  if (!body?.task || !body?.template)
    return json({ error: "Missing task/template" }, { status: 400 });
  const prompt = await prisma.prompt.findUnique({
    where: { task: body.task },
  });
  if (!prompt) return json({ error: "Prompt not found" }, { status: 404 });
  const version = await prisma.promptVersion.create({
    data: {
      promptId: prompt.id,
      template: body.template,
      system: body.system ?? null,
      modelOverride: body.modelOverride ?? null,
      tempOverride:
        typeof body.tempOverride === "number" ? body.tempOverride : null,
      topPOverride:
        typeof body.topPOverride === "number" ? body.topPOverride : null,
    },
  });
  return json({ version });
}
