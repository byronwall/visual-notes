import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "@solid-mediakit/auth";
import { authOptions } from "~/server/auth";
import { prisma } from "~/server/db";

import { generatePromptTemplateFromFeedback } from "../../../server/features/synthesizeFromFeedback";

export async function GET(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  const prompts = await prisma.prompt.findMany({
    include: {
      activeVersion: true,
      versions: { orderBy: { createdAt: "desc" }, take: 10 },
    },
    orderBy: { task: "asc" },
  });
  return json({ prompts });
}

export async function POST(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  const body = await event.request.json().catch(() => null);

  if (body?.action === "generate_from_feedback") {
    const { task } = body ?? {};
    if (!task) return json({ error: "Missing task" }, { status: 400 });
    const { version } = await generatePromptTemplateFromFeedback({
      task,
      minRating:
        typeof body.minRating === "number" ? body.minRating : undefined,
      lookbackDays:
        typeof body.lookbackDays === "number" ? body.lookbackDays : undefined,
      limit: typeof body.limit === "number" ? body.limit : undefined,
      modelOverride:
        typeof body.model === "string" && body.model ? body.model : undefined,
      createdById: session.user?.id ?? undefined,
    });
    return json({ ok: true, version });
  }
  if (!body?.id) return json({ error: "Missing id" }, { status: 400 });
  const data: any = {};
  if (typeof body.defaultModel === "string")
    data.defaultModel = body.defaultModel;
  if (typeof body.defaultTemp === "number") data.defaultTemp = body.defaultTemp;
  if (typeof body.defaultTopP === "number" || body.defaultTopP === null)
    data.defaultTopP = body.defaultTopP;
  await prisma.prompt.update({ where: { id: body.id }, data });
  return json({ ok: true });
}
