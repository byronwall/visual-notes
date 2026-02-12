import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import type {
  ActionEventItem,
  ActivityTimelineFilter,
  DocActivityHistory,
  DocActivitySummary,
} from "./activity.types";

function parseIsoDate(input?: string): Date | undefined {
  if (!input) return undefined;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export const fetchTimelineEvents = query(
  async (input: ActivityTimelineFilter = {}): Promise<ActionEventItem[]> => {
    "use server";
    const take = Math.max(1, Math.min(200, input.take ?? 50));
    const from = parseIsoDate(input.from);
    const to = parseIsoDate(input.to);
    const cursor = input.cursor?.trim();

    const where: Record<string, unknown> = {};
    if (input.eventType?.trim()) where.eventType = input.eventType.trim();
    if (input.entityType?.trim()) where.entityType = input.entityType.trim();
    if (input.actorId?.trim()) where.actorId = input.actorId.trim();
    if (input.relatedDocId?.trim()) where.relatedDocId = input.relatedDocId.trim();
    if (input.docPathPrefix?.trim()) {
      where.relatedDoc = {
        path: { startsWith: input.docPathPrefix.trim() },
      };
    }
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const items = await prisma.actionEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take,
      include: {
        relatedDoc: {
          select: {
            title: true,
            path: true,
          },
        },
      },
    });

    return items.map((item) => ({
      id: item.id,
      createdAt: item.createdAt.toISOString(),
      eventType: item.eventType,
      actorId: item.actorId,
      actorType: item.actorType,
      entityType: item.entityType,
      entityId: item.entityId,
      relatedDocId: item.relatedDocId,
      relatedDocTitle: item.relatedDoc?.title ?? null,
      relatedDocPath: item.relatedDoc?.path ?? null,
      payload:
        item.payload && typeof item.payload === "object" && !Array.isArray(item.payload)
          ? (item.payload as Record<string, unknown>)
          : null,
    }));
  },
  "activity-timeline-events"
);

export const fetchDocActivityHistory = query(
  async (docId: string): Promise<DocActivityHistory | null> => {
    "use server";
    if (!docId) return null;
    const generatedAt = new Date().toISOString();

    const where = { relatedDocId: docId };
    const [viewCount, editCount, searchOpenedCount, items] = await Promise.all([
      prisma.actionEvent.count({ where: { ...where, eventType: "doc.view" } }),
      prisma.actionEvent.count({ where: { ...where, eventType: "doc.update" } }),
      prisma.actionEvent.count({
        where: { ...where, eventType: "search.result.opened" },
      }),
      prisma.actionEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          relatedDoc: {
            select: {
              title: true,
              path: true,
            },
          },
        },
      }),
    ]);

    const events: ActionEventItem[] = items.map((item) => ({
      id: item.id,
      createdAt: item.createdAt.toISOString(),
      eventType: item.eventType,
      actorId: item.actorId,
      actorType: item.actorType,
      entityType: item.entityType,
      entityId: item.entityId,
      relatedDocId: item.relatedDocId,
      relatedDocTitle: item.relatedDoc?.title ?? null,
      relatedDocPath: item.relatedDoc?.path ?? null,
      payload:
        item.payload && typeof item.payload === "object" && !Array.isArray(item.payload)
          ? (item.payload as Record<string, unknown>)
          : null,
    }));

    const viewEvents = events.filter((event) => event.eventType === "doc.view");
    const lastViewBeforeThisOne =
      (viewEvents.length >= 2 ? viewEvents[1] : viewEvents[0])?.createdAt ??
      null;

    return {
      docId,
      generatedAt,
      viewCount,
      editCount,
      searchOpenedCount,
      lastViewBeforeThisOne,
      events,
    };
  },
  "activity-doc-history"
);

export const fetchDocActivitySummary = query(
  async (docId: string): Promise<DocActivitySummary | null> => {
    "use server";
    if (!docId) return null;
    const snapshot = await prisma.docActivitySnapshot.findUnique({
      where: { docId },
      select: {
        docId: true,
        views30d: true,
        edits30d: true,
        searchClicks30d: true,
        lastViewedAt: true,
        lastEditedAt: true,
        lastInteractedAt: true,
        activityClass: true,
        updatedAt: true,
      },
    });
    if (!snapshot) return null;

    return {
      docId: snapshot.docId,
      views30d: snapshot.views30d,
      edits30d: snapshot.edits30d,
      searchClicks30d: snapshot.searchClicks30d,
      lastViewedAt: snapshot.lastViewedAt?.toISOString() ?? null,
      lastEditedAt: snapshot.lastEditedAt?.toISOString() ?? null,
      lastInteractedAt: snapshot.lastInteractedAt?.toISOString() ?? null,
      activityClass: snapshot.activityClass,
      updatedAt: snapshot.updatedAt.toISOString(),
    };
  },
  "activity-doc-summary"
);
