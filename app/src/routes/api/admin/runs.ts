import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "@solid-mediakit/auth";
import { authOptions } from "~/server/auth";
import { prisma } from "~/server/db";

export async function GET(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(event.request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "50", 10),
    200
  );
  const runs = await prisma.promptRun.findMany({
    orderBy: { createdAt: "desc" },
    take: isNaN(limit) ? 50 : limit,
    include: {
      promptVersion: { include: { Prompt: true } },
      HumanFeedback: { orderBy: { createdAt: "desc" } },
    },
  });
  return json({ runs });
}

export async function POST(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  const body = await event.request.json().catch(() => null);
  if (!body?.runId) return json({ error: "Missing runId" }, { status: 400 });
  await prisma.humanFeedback.create({
    data: {
      promptRunId: body.runId,
      rating: typeof body.rating === "number" ? body.rating : null,
      comment: typeof body.comment === "string" ? body.comment : null,
      createdById: session.user?.id ?? null,
    },
  });
  return json({ ok: true });
}

export async function DELETE(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(event.request.url);
  const feedbackId = url.searchParams.get("feedbackId");
  const runId = url.searchParams.get("runId");
  if (!feedbackId && !runId)
    return json({ error: "Missing feedbackId or runId" }, { status: 400 });

  if (feedbackId) {
    await prisma.humanFeedback.delete({ where: { id: feedbackId } });
  } else if (runId) {
    await prisma.humanFeedback.deleteMany({
      where: { promptRunId: runId },
    });
  }

  return json({ ok: true });
}
