import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import { parseCookie, MAGIC_COOKIE_NAME } from "~/server/magic-auth";
import { createHash } from "crypto";

function getUserIdFromRequest(request: Request): string {
  const cookies = parseCookie(request.headers.get("cookie"));
  const token = cookies[MAGIC_COOKIE_NAME] || "anonymous";
  const hash = createHash("sha256").update(token).digest("hex");
  return `magic_${hash.slice(0, 24)}`;
}

export async function GET(event: APIEvent) {
  const userId = getUserIdFromRequest(event.request);
  const url = new URL(event.request.url);
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit") || "50"))
  );
  const threads = await prisma.chatThread.findMany({
    where: { userId },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: limit,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, role: true, contentHtml: true, createdAt: true },
      },
    },
  });
  const items = threads.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    noteId: t.noteId,
    lastMessageAt: t.lastMessageAt,
    updatedAt: t.updatedAt,
    preview:
      t.messages?.[0]
        ? {
            id: t.messages[0].id,
            role: t.messages[0].role,
            contentHtml: t.messages[0].contentHtml,
            createdAt: t.messages[0].createdAt,
          }
        : null,
  }));
  return json({ items });
}

export async function POST(event: APIEvent) {
  try {
    const userId = getUserIdFromRequest(event.request);
    const body = await event.request.json();
    const noteId = typeof body?.noteId === "string" ? body.noteId : undefined;
    const titleRaw = typeof body?.title === "string" ? body.title : undefined;
    if (!noteId) return json({ error: "noteId required" }, { status: 400 });
    const title =
      (titleRaw && titleRaw.trim()) || `Chat about ${noteId.slice(0, 12)}…`;
    const thread = await prisma.chatThread.create({
      data: {
        userId,
        noteId,
        title,
        status: "ACTIVE",
        lastMessageAt: new Date(),
      },
    });
    return json({ item: thread });
  } catch (e) {
    const msg = (e as Error)?.message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}


