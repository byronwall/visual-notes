import { action } from "@solidjs/router";
import { prisma } from "~/server/db";
import { logActionEvent, logDocView } from "~/server/events/action-events";

const WINDOW_DAYS = 30;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

function startOfUtcDay(input: Date): Date {
  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate())
  );
}

function activityClassForWindow(views30d: number, edits30d: number) {
  if (views30d <= 0 && edits30d <= 0) return "COLD" as const;
  if (edits30d >= 2 * Math.max(views30d, 1)) return "EDIT_HEAVY" as const;
  if (views30d >= 2 * Math.max(edits30d, 1)) return "READ_HEAVY" as const;
  return "BALANCED" as const;
}

export const recomputeDocActivitySnapshots = action(
  async (payload?: { docIds?: string[]; limit?: number }) => {
    "use server";
    const now = new Date();
    const since = startOfUtcDay(new Date(now.getTime() - WINDOW_MS));
    const limit = Math.max(1, Math.min(5000, payload?.limit ?? 1000));

    const docIds = Array.from(new Set((payload?.docIds ?? []).filter(Boolean)));
    const docs =
      docIds.length > 0
        ? await prisma.doc.findMany({
            where: { id: { in: docIds } },
            select: { id: true },
            take: limit,
          })
        : await prisma.doc.findMany({
            select: { id: true },
            orderBy: { updatedAt: "desc" },
            take: limit,
          });

    let updated = 0;
    for (const doc of docs) {
      const dailyRows = await prisma.docActivityDaily.findMany({
        where: {
          docId: doc.id,
          date: { gte: since },
        },
        select: {
          viewCount: true,
          editCount: true,
          searchClickCount: true,
        },
      });
      const views30d = dailyRows.reduce((acc, row) => acc + row.viewCount, 0);
      const edits30d = dailyRows.reduce((acc, row) => acc + row.editCount, 0);
      const searchClicks30d = dailyRows.reduce(
        (acc, row) => acc + row.searchClickCount,
        0
      );

      const [lastViewed, lastEdited, lastSearchClick] = await Promise.all([
        prisma.actionEvent.findFirst({
          where: { relatedDocId: doc.id, eventType: "doc.view" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.actionEvent.findFirst({
          where: { relatedDocId: doc.id, eventType: "doc.update" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.actionEvent.findFirst({
          where: { relatedDocId: doc.id, eventType: "search.result.opened" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);

      const lastInteractedAt = [lastViewed, lastEdited, lastSearchClick]
        .map((row) => row?.createdAt ?? null)
        .filter((value): value is Date => Boolean(value))
        .sort((a, b) => b.getTime() - a.getTime())[0];

      await prisma.docActivitySnapshot.upsert({
        where: { docId: doc.id },
        update: {
          views30d,
          edits30d,
          searchClicks30d,
          lastViewedAt: lastViewed?.createdAt ?? null,
          lastEditedAt: lastEdited?.createdAt ?? null,
          lastInteractedAt: lastInteractedAt ?? null,
          activityClass: activityClassForWindow(views30d, edits30d),
        },
        create: {
          docId: doc.id,
          views30d,
          edits30d,
          searchClicks30d,
          lastViewedAt: lastViewed?.createdAt ?? null,
          lastEditedAt: lastEdited?.createdAt ?? null,
          lastInteractedAt: lastInteractedAt ?? null,
          activityClass: activityClassForWindow(views30d, edits30d),
        },
      });
      updated++;
    }

    return { ok: true, updated };
  },
  "activity-recompute-doc-snapshots"
);

export const logDocViewEvent = action(async (docId: string) => {
  "use server";
  if (!docId) return { ok: false };
  await logDocView(docId, { source: "doc_route" });
  return { ok: true };
}, "activity-log-doc-view");

export const logSearchResultOpened = action(
  async (payload: {
    docId: string;
    queryLength: number;
    tokenCount: number;
    queryPreview?: string;
  }) => {
    "use server";
    if (!payload.docId) return { ok: false };
    const doc = await prisma.doc.findUnique({
      where: { id: payload.docId },
      select: { title: true },
    });
    await logActionEvent({
      eventType: "search.result.opened",
      entityType: "doc",
      entityId: payload.docId,
      relatedDocId: payload.docId,
      docMetric: "search_click",
      payload: {
        docTitle: doc?.title ?? null,
        queryPreview: payload.queryPreview?.slice(0, 120) ?? null,
        queryLength: payload.queryLength,
        tokenCount: payload.tokenCount,
      },
    });
    return { ok: true };
  },
  "activity-log-search-result-opened"
);
