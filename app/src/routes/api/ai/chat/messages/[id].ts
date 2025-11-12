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

export async function PATCH(event: APIEvent) {
  try {
    const userId = getUserIdFromRequest(event.request);
    const id = event.params.id!;
    const body = await event.request.json();
    const contentHtml =
      typeof body?.contentHtml === "string" ? body.contentHtml : "";
    if (!contentHtml.trim())
      return json({ error: "contentHtml required" }, { status: 400 });

    // Ensure the message belongs to the user's thread
    const msg = await prisma.chatMessage.findUnique({
      where: { id },
      include: { thread: { select: { id: true, userId: true } } },
    });
    if (!msg || msg.thread.userId !== userId) {
      return json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.chatMessage.update({
      where: { id },
      data: { contentHtml, isEdited: true },
    });
    // Touch thread updatedAt/lastMessageAt
    await prisma.chatThread.update({
      where: { id: msg.thread.id },
      data: { updatedAt: new Date(), lastMessageAt: new Date() },
    });
    return json({ item: updated });
  } catch (e) {
    const msg = (e as Error)?.message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(event: APIEvent) {
  try {
    const userId = getUserIdFromRequest(event.request);
    const id = event.params.id!;

    // Ensure the message belongs to the user's thread
    const msg = await prisma.chatMessage.findUnique({
      where: { id },
      include: { thread: { select: { id: true, userId: true } } },
    });
    if (!msg || msg.thread.userId !== userId) {
      return json({ error: "Not found" }, { status: 404 });
    }

    // Delete the message
    await prisma.chatMessage.delete({ where: { id } });

    // Recompute lastMessageAt based on remaining messages in the thread
    const latest = await prisma.chatMessage.findFirst({
      where: { threadId: msg.thread.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    await prisma.chatThread.update({
      where: { id: msg.thread.id },
      data: {
        updatedAt: new Date(),
        lastMessageAt: latest?.createdAt ?? new Date(),
      },
    });
    return json({ ok: true });
  } catch (e) {
    const msg = (e as Error)?.message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}
