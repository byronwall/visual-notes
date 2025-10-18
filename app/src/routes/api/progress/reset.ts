import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "@solid-mediakit/auth";
import { authOptions } from "~/server/auth";
import { prisma } from "~/server/db";
import { z } from "zod";

const bodySchema = z.object({ planId: z.string() });

export async function POST(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await event.request.json();
    const input = bodySchema.parse(body);
    await prisma.readingProgress.deleteMany({
      where: { userId: session.user.id, planId: input.planId },
    });
    return json({ ok: true });
  } catch (e) {
    const msg = (e as Error).message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}
