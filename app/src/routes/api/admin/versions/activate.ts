import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "@solid-mediakit/auth";
import { authOptions } from "~/server/auth";
import { prisma } from "~/server/db";

export async function POST(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  const body = await event.request.json().catch(() => null);
  if (!body?.promptId || !body?.versionId)
    return json({ error: "Missing promptId/versionId" }, { status: 400 });
  await prisma.prompt.update({
    where: { id: body.promptId },
    data: { activeVersionId: body.versionId },
  });
  return json({ ok: true });
}
