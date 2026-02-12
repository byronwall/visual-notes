import { type Prisma } from "@prisma/client";
import { getRequestEvent } from "solid-js/web";
import { prisma } from "~/server/db";
import { isRequestAuthenticated } from "~/server/magic-auth";
import { getMagicUserIdFromRequest } from "~/services/ai/ai-auth";

type ActorType = "magic_user" | "anonymous" | "system";
type DocMetricKind = "view" | "edit" | "search_click";

type EventContext = {
  actorId?: string | null;
  actorType?: ActorType;
  sessionId?: string | null;
  requestId?: string | null;
};

export type LogActionEventInput = {
  eventType: string;
  entityType: string;
  entityId?: string | null;
  relatedDocId?: string | null;
  payload?: Prisma.InputJsonValue | null;
  docMetric?: DocMetricKind;
  context?: EventContext;
};

type ResolvedContext = {
  actorId: string | null;
  actorType: ActorType;
  sessionId: string | null;
  requestId: string | null;
};

function startOfUtcDay(input: Date): Date {
  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate())
  );
}

function getDocMetricFromEventType(eventType: string): DocMetricKind | undefined {
  if (eventType === "doc.view") return "view";
  if (eventType === "doc.update") return "edit";
  if (eventType === "search.result.opened") return "search_click";
  return undefined;
}

function activityClassForWindow(
  views30d: number,
  edits30d: number
): "READ_HEAVY" | "EDIT_HEAVY" | "BALANCED" | "COLD" {
  if (views30d <= 0 && edits30d <= 0) return "COLD";
  if (edits30d >= 2 * Math.max(views30d, 1)) return "EDIT_HEAVY";
  if (views30d >= 2 * Math.max(edits30d, 1)) return "READ_HEAVY";
  return "BALANCED";
}

function resolveContext(context?: EventContext): ResolvedContext {
  if (context?.actorType === "system") {
    return {
      actorId: context.actorId ?? "system",
      actorType: "system",
      sessionId: context.sessionId ?? null,
      requestId: context.requestId ?? null,
    };
  }

  const event = getRequestEvent();
  const request = event?.request;
  const headerRequestId = request?.headers.get("x-request-id") ?? null;
  const resolvedRequestId = context?.requestId ?? headerRequestId;

  if (context?.actorId) {
    return {
      actorId: context.actorId,
      actorType: context.actorType ?? "magic_user",
      sessionId: context.sessionId ?? null,
      requestId: resolvedRequestId,
    };
  }

  if (request && isRequestAuthenticated(request)) {
    return {
      actorId: getMagicUserIdFromRequest(request),
      actorType: "magic_user",
      sessionId: context?.sessionId ?? null,
      requestId: resolvedRequestId,
    };
  }

  return {
    actorId: context?.actorId ?? null,
    actorType: context?.actorType ?? "anonymous",
    sessionId: context?.sessionId ?? null,
    requestId: resolvedRequestId,
  };
}

async function recomputeSnapshot(
  tx: Prisma.TransactionClient,
  docId: string,
  now: Date
) {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dailyRows = await tx.docActivityDaily.findMany({
    where: {
      docId,
      date: { gte: startOfUtcDay(since) },
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
    tx.actionEvent.findFirst({
      where: { relatedDocId: docId, eventType: "doc.view" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    tx.actionEvent.findFirst({
      where: { relatedDocId: docId, eventType: "doc.update" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    tx.actionEvent.findFirst({
      where: { relatedDocId: docId, eventType: "search.result.opened" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const lastInteractedAt = [lastViewed, lastEdited, lastSearchClick]
    .map((row) => row?.createdAt ?? null)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  await tx.docActivitySnapshot.upsert({
    where: { docId },
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
      docId,
      views30d,
      edits30d,
      searchClicks30d,
      lastViewedAt: lastViewed?.createdAt ?? null,
      lastEditedAt: lastEdited?.createdAt ?? null,
      lastInteractedAt: lastInteractedAt ?? null,
      activityClass: activityClassForWindow(views30d, edits30d),
    },
  });
}

export async function logActionEvent(input: LogActionEventInput): Promise<void> {
  const now = new Date();
  const context = resolveContext(input.context);
  const docMetric = input.docMetric ?? getDocMetricFromEventType(input.eventType);
  const shouldTrackDocMetrics = Boolean(input.relatedDocId && docMetric);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.actionEvent.create({
        data: {
          eventType: input.eventType,
          actorId: context.actorId,
          actorType: context.actorType,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          relatedDocId: input.relatedDocId ?? null,
          sessionId: context.sessionId,
          requestId: context.requestId,
          payload: input.payload ?? undefined,
        },
      });

      if (!shouldTrackDocMetrics || !input.relatedDocId) return;
      const date = startOfUtcDay(now);
      const increments =
        docMetric === "view"
          ? { viewCount: 1 }
          : docMetric === "edit"
            ? { editCount: 1 }
            : { searchClickCount: 1 };

      await tx.docActivityDaily.upsert({
        where: {
          docId_date: {
            docId: input.relatedDocId,
            date,
          },
        },
        update: increments,
        create: {
          docId: input.relatedDocId,
          date,
          ...increments,
        },
      });

      await recomputeSnapshot(tx, input.relatedDocId, now);
    });
  } catch (error) {
    console.error("[action-events] write failed", {
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      relatedDocId: input.relatedDocId ?? null,
      error,
    });
  }
}

export function lengthDeltaBucket(beforeLength: number, afterLength: number): string {
  const delta = afterLength - beforeLength;
  if (delta <= -500) return "down_500_plus";
  if (delta < -100) return "down_100_499";
  if (delta < 0) return "down_1_99";
  if (delta === 0) return "flat";
  if (delta < 100) return "up_1_99";
  if (delta < 500) return "up_100_499";
  return "up_500_plus";
}

export async function logDocView(docId: string, payload?: Prisma.InputJsonValue) {
  await logActionEvent({
    eventType: "doc.view",
    entityType: "doc",
    entityId: docId,
    relatedDocId: docId,
    payload,
    docMetric: "view",
  });
}

export async function logDocUpdate(
  docId: string,
  fieldsChanged: string[],
  payload?: Prisma.InputJsonValue
) {
  await logActionEvent({
    eventType: "doc.update",
    entityType: "doc",
    entityId: docId,
    relatedDocId: docId,
    payload: {
      fieldsChanged,
      ...(payload && typeof payload === "object" && !Array.isArray(payload)
        ? payload
        : {}),
    } as Prisma.InputJsonValue,
    docMetric: "edit",
  });
}
