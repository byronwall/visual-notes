import { action } from "@solidjs/router";
import { z } from "zod";
import { prisma } from "~/server/db";
import { callLLM } from "~/server/lib/ai";
import {
  looksLikeMarkdown,
  normalizeMarkdownToHtml,
  sanitizeHtmlContent,
} from "~/server/lib/markdown";
import { getMagicUserIdFromEvent } from "~/services/ai/ai-auth";
import { logActionEvent } from "~/server/events/action-events";

const createThreadInput = z.object({
  noteId: z.string().min(1),
  title: z.string().optional(),
});

const updateThreadInput = z.object({
  id: z.string().min(1),
  hasUnread: z.boolean().optional(),
  status: z.enum(["ACTIVE", "LOADING", "DONE"]).optional(),
});

const sendMessageInput = z.object({
  threadId: z.string().min(1),
  text: z.string().min(1),
});

const updateMessageInput = z.object({
  id: z.string().min(1),
  contentHtml: z.string().min(1),
});

const deleteMessageInput = z.object({
  id: z.string().min(1),
});

export const createChatThread = action(
  async (payload: z.infer<typeof createThreadInput>) => {
    "use server";
    const userId = getMagicUserIdFromEvent();
    const input = createThreadInput.parse(payload);
    const title =
      input.title?.trim() || `Chat about ${input.noteId.slice(0, 12)}…`;
    const thread = await prisma.chatThread.create({
      data: {
        userId,
        noteId: input.noteId,
        title,
        status: "ACTIVE",
        lastMessageAt: new Date(),
      },
    });
    await logActionEvent({
      eventType: "ai.chat.thread_created",
      entityType: "chat_thread",
      entityId: thread.id,
      relatedDocId: thread.noteId,
      payload: {
        noteId: thread.noteId,
        hasCustomTitle: Boolean(input.title?.trim()),
      },
      context: { actorId: userId, actorType: "magic_user" },
    });
    return { item: thread };
  },
  "ai-chat-thread-create",
);

export const updateChatThread = action(
  async (payload: z.infer<typeof updateThreadInput>) => {
    "use server";
    const userId = getMagicUserIdFromEvent();
    const input = updateThreadInput.parse(payload);
    const thread = await prisma.chatThread.findFirst({
      where: { id: input.id, userId },
      select: { id: true },
    });
    if (!thread) throw new Error("Not found");

    const data: Record<string, unknown> = {};
    if (typeof input.hasUnread === "boolean") data.hasUnread = input.hasUnread;
    if (input.status) data.status = input.status;
    if (Object.keys(data).length === 0) throw new Error("No valid fields");

    const updated = await prisma.chatThread.update({
      where: { id: thread.id },
      data: { ...data, updatedAt: new Date() },
    });
    return { item: updated };
  },
  "ai-chat-thread-update",
);

export const sendChatMessage = action(
  async (payload: z.infer<typeof sendMessageInput>) => {
    "use server";
    const userId = getMagicUserIdFromEvent();
    const input = sendMessageInput.parse(payload);
    if (!input.text.trim()) throw new Error("text required");

    const thread = await prisma.chatThread.findFirst({
      where: { id: input.threadId, userId },
    });
    if (!thread) throw new Error("Not found");

    const userMsg = await prisma.chatMessage.create({
      data: {
        threadId: thread.id,
        role: "user",
        contentHtml: sanitizeHtmlContent(
          looksLikeMarkdown(input.text)
            ? normalizeMarkdownToHtml(input.text)
            : input.text,
        ),
      },
    });
    await logActionEvent({
      eventType: "ai.chat.message_sent",
      entityType: "chat_thread",
      entityId: thread.id,
      relatedDocId: thread.noteId,
      payload: {
        messageLength: input.text.length,
      },
      context: { actorId: userId, actorType: "magic_user" },
    });

    await prisma.chatThread.update({
      where: { id: thread.id },
      data: { status: "LOADING", lastMessageAt: new Date() },
    });

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
            m.contentHtml,
          )}`,
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
            looksLikeMarkdown(output)
              ? normalizeMarkdownToHtml(output)
              : output,
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

    return { userMessage: userMsg, assistantMessage: assistantMsg };
  },
  "ai-chat-message-send",
);

export const updateChatMessage = action(
  async (payload: z.infer<typeof updateMessageInput>) => {
    "use server";
    const userId = getMagicUserIdFromEvent();
    const input = updateMessageInput.parse(payload);
    if (!input.contentHtml.trim()) throw new Error("contentHtml required");

    const msg = await prisma.chatMessage.findUnique({
      where: { id: input.id },
      include: { thread: { select: { id: true, userId: true } } },
    });
    if (!msg || msg.thread.userId !== userId) throw new Error("Not found");

    const updated = await prisma.chatMessage.update({
      where: { id: input.id },
      data: { contentHtml: input.contentHtml, isEdited: true },
    });
    await prisma.chatThread.update({
      where: { id: msg.thread.id },
      data: { updatedAt: new Date(), lastMessageAt: new Date() },
    });
    return { item: updated };
  },
  "ai-chat-message-update",
);

export const deleteChatMessage = action(
  async (payload: z.infer<typeof deleteMessageInput>) => {
    "use server";
    const userId = getMagicUserIdFromEvent();
    const input = deleteMessageInput.parse(payload);

    const msg = await prisma.chatMessage.findUnique({
      where: { id: input.id },
      include: { thread: { select: { id: true, userId: true } } },
    });
    if (!msg || msg.thread.userId !== userId) throw new Error("Not found");

    await prisma.chatMessage.delete({ where: { id: input.id } });

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
    return { ok: true };
  },
  "ai-chat-message-delete",
);
