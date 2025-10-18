import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "@solid-mediakit/auth";
import { authOptions } from "~/server/auth";
import { prisma } from "~/server/db";

export async function GET(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  const planId = new URL(event.request.url).searchParams.get("planId");
  if (!planId) return json({ error: "Missing planId" }, { status: 400 });
  const rows = await prisma.readingProgress.findMany({
    where: { userId: session.user.id, planId },
    select: { dayId: true, passageId: true, done: true },
  });
  return json(rows);
}
