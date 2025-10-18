import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "@solid-mediakit/auth";
import { authOptions } from "~/server/auth";
import { prisma } from "~/server/db";
import { z } from "zod";

const bodySchema = z.object({
  planId: z.string(),
  dayId: z.string(),
  passageId: z.string(),
  done: z.boolean(),
});

export async function POST(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await event.request.json();
    const input = bodySchema.parse(body);
    console.log("[api] POST /api/progress/mark", {
      userId: session.user.id,
      planId: input.planId,
      dayId: input.dayId,
      passageId: input.passageId,
      done: input.done,
    });
    const row = await prisma.readingProgress.upsert({
      where: {
        userId_dayId_passageId: {
          userId: session.user.id,
          dayId: input.dayId,
          passageId: input.passageId,
        },
      },
      create: {
        userId: session.user.id,
        planId: input.planId,
        dayId: input.dayId,
        passageId: input.passageId,
        done: input.done,
      },
      update: { done: input.done },
      select: { dayId: true, passageId: true, done: true },
    });
    console.log("[api] mark upserted", row);
    return json(row);
  } catch (e) {
    console.error("[api] mark error", e);
    const msg = (e as Error).message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}
