import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import { getMagicUserIdFromEvent } from "~/services/ai/ai-auth";

export type ChatThreadStatus = "ACTIVE" | "LOADING" | "DONE";

export type ChatMessageRole = "user" | "assistant";

export type ChatThreadPreview = {
  id: string;
  title: string;
  status: ChatThreadStatus;
  hasUnread: boolean;
  noteId: string | null;
  lastMessageAt: string;
  updatedAt: string;
  preview: {
    id: string;
    role: ChatMessageRole;
    contentHtml: string;
    createdAt: string;
  } | null;
};

export type ChatThreadDetail = {
  id: string;
  title: string;
  status: ChatThreadStatus;
  hasUnread: boolean;
  noteId: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    role: ChatMessageRole;
    contentHtml: string;
    isEdited: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type ChatThreadsQuery = { limit?: number };

export const fetchChatThreads = query(
  async (input: ChatThreadsQuery = {}): Promise<ChatThreadPreview[]> => {
    "use server";
    const userId = getMagicUserIdFromEvent();
    const limit = Math.min(200, Math.max(1, Number(input.limit ?? 50)));
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
    return threads.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as ChatThreadStatus,
      hasUnread: t.hasUnread,
      noteId: t.noteId,
      lastMessageAt: t.lastMessageAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      preview: t.messages?.[0]
        ? {
            id: t.messages[0].id,
            role: t.messages[0].role as ChatMessageRole,
            contentHtml: t.messages[0].contentHtml,
            createdAt: t.messages[0].createdAt.toISOString(),
          }
        : null,
    }));
  },
  "ai-chat-threads"
);

export const fetchChatThread = query(
  async (id: string): Promise<ChatThreadDetail | null> => {
    "use server";
    if (!id) return null;
    const userId = getMagicUserIdFromEvent();
    const thread = await prisma.chatThread.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            contentHtml: true,
            isEdited: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!thread) return null;
    return {
      id: thread.id,
      title: thread.title,
      status: thread.status as ChatThreadStatus,
      hasUnread: thread.hasUnread,
      noteId: thread.noteId,
      lastMessageAt: thread.lastMessageAt.toISOString(),
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      messages: thread.messages.map((m) => ({
        id: m.id,
        role: m.role as ChatMessageRole,
        contentHtml: m.contentHtml,
        isEdited: m.isEdited,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
    };
  },
  "ai-chat-thread"
);
