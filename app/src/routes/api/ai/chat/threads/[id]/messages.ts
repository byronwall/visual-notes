import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import { parseCookie, MAGIC_COOKIE_NAME } from "~/server/magic-auth";
import { createHash } from "crypto";
import { callLLM } from "~/server/lib/ai";
import {
  sanitizeHtmlContent,
  looksLikeMarkdown,
  normalizeMarkdownToHtml,
} from "~/server/lib/markdown";

function getUserIdFromRequest(request: Request): string {
  const cookies = parseCookie(request.headers.get("cookie"));
  const token = cookies[MAGIC_COOKIE_NAME] || "anonymous";
  const hash = createHash("sha256").update(token).digest("hex");
  return `magic_${hash.slice(0, 24)}`;
}

export async function POST(event: APIEvent) {
  try {
    const userId = getUserIdFromRequest(event.request);
    const id = event.params.id!;
    const body = await event.request.json();
    const text = typeof body?.text === "string" ? body.text : "";
    if (!text.trim()) return json({ error: "text required" }, { status: 400 });

    const thread = await prisma.chatThread.findFirst({
      where: { id, userId },
    });
    if (!thread) return json({ error: "Not found" }, { status: 404 });

    // Create user message
    const userMsg = await prisma.chatMessage.create({
      data: {
        threadId: thread.id,
        role: "user",
        contentHtml: sanitizeHtmlContent(
          looksLikeMarkdown(text) ? normalizeMarkdownToHtml(text) : text
        ),
      },
    });

    // Mark thread as loading and touch lastMessageAt
    await prisma.chatThread.update({
      where: { id: thread.id },
      data: { status: "LOADING", lastMessageAt: new Date() },
    });

    // Build simple transcript as plain text for LLM
    const recent = await prisma.chatMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, contentHtml: true },
    });
    const toPlain = (html: string) =>
      html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, "")
        .trim();
    const transcript = recent
      .map(
        (m) =>
          `${m.role === "user" ? "User" : "Assistant"}: ${toPlain(
            m.contentHtml
          )}`
      )
      .join("\n\n");

    const { output } = await callLLM({
      user: transcript,
      model: "gpt-4o-mini",
      temperature: 0.2,
      top_p: undefined,
      noteId: thread.noteId,
    });

    const html =
      output && output.trim().length
        ? sanitizeHtmlContent(
            looksLikeMarkdown(output) ? normalizeMarkdownToHtml(output) : output
          )
        : "<p>(no response)</p>";

    const assistantMsg = await prisma.chatMessage.create({
      data: {
        threadId: thread.id,
        role: "assistant",
        contentHtml: html,
      },
    });

    await prisma.chatThread.update({
      where: { id: thread.id },
      data: { status: "DONE", hasUnread: true, lastMessageAt: new Date() },
    });

    return json({ userMessage: userMsg, assistantMessage: assistantMsg });
  } catch (e) {
    const msg = (e as Error)?.message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}
