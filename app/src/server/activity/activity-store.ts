import { prisma } from "~/server/db";
import type {
  ActionEventItem,
  ActivityTimelineFilter,
} from "~/services/activity/activity.types";

// The activity timeline read, shared by the Activity page and the MCP
// connector's activity_recent tool.

function parseIsoDate(input?: string): Date | undefined {
  if (!input) return undefined;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

/** Event types a domain covers: "task" also covers task_list.*, "time_block" time_block_day.*. */
export const eventTypeFilterForDomain = (domain: string) =>
  domain === "task" || domain === "time_block"
    ? { startsWith: domain }
    : { startsWith: `${domain}.` };

export async function listTimelineEvents(
  input: ActivityTimelineFilter = {},
): Promise<ActionEventItem[]> {
  const take = Math.max(1, Math.min(200, input.take ?? 50));
  const from = parseIsoDate(input.from);
  const to = parseIsoDate(input.to);
  const cursor = input.cursor?.trim();

  const where: Record<string, unknown> = {};
  if (input.eventType?.trim()) {
    where.eventType = input.eventType.trim();
  } else if (input.eventDomain?.trim()) {
    where.eventType = eventTypeFilterForDomain(input.eventDomain.trim());
  }
  if (input.entityType?.trim()) where.entityType = input.entityType.trim();
  if (input.actorId?.trim()) where.actorId = input.actorId.trim();
  if (input.relatedDocId?.trim())
    where.relatedDocId = input.relatedDocId.trim();
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
      item.payload &&
      typeof item.payload === "object" &&
      !Array.isArray(item.payload)
        ? (item.payload as Record<string, unknown>)
        : null,
  }));
}
