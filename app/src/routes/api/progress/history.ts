import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "@solid-mediakit/auth";
import { authOptions } from "~/server/auth";
import { prisma } from "~/server/db";

export async function GET(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  const planId = new URL(event.request.url).searchParams.get("planId");
  console.log("[api] GET /api/progress/history", {
    userId: session.user.id,
    planId: planId || null,
  });
  const rows = await prisma.readingProgress.findMany({
    where: {
      userId: session.user.id,
      ...(planId ? { planId } : {}),
      done: true,
    },
    select: {
      dayId: true,
      passageId: true,
      updatedAt: true,
      day: { select: { label: true, position: true, planId: true } },
      passage: { select: { ref: true, norm: true } },
      planId: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  console.log("[api] history rows", { count: rows.length });
  return json(rows);
}
