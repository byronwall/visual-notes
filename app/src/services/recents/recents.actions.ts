import { action, json } from "@solidjs/router";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import { fetchRecentItems } from "./recents.queries";
import { RECENT_KINDS, type RecentViewKind } from "./recents.types";

const VIEW_KINDS = RECENT_KINDS.filter((kind) => kind !== "note");
const MAX_ID_LENGTH = 200;

/**
 * Tags and paths are free-form URL segments, so only log ones that match
 * real notes; a typo'd /tags/projetc should not linger in Recent.
 * Collections and research topics are checked when the list resolves.
 */
async function viewTargetExists(kind: RecentViewKind, id: string) {
  if (kind === "tag") {
    return !!(await prisma.docBlock.findFirst({
      where: { tags: { has: id } },
      select: { id: true },
    }));
  }
  if (kind === "path") {
    return !!(await prisma.doc.findFirst({
      where: { OR: [{ path: id }, { path: { startsWith: `${id}.` } }] },
      select: { id: true },
    }));
  }
  return true;
}

/** Records a visit to a collection, research topic, tag, or path page. */
export const logRecentView = action(
  async (kind: RecentViewKind, id: string) => {
    "use server";
    const entityId = String(id || "").trim();
    // Server actions accept any payload; notes log `doc.view` themselves.
    if (
      !entityId ||
      entityId.length > MAX_ID_LENGTH ||
      !VIEW_KINDS.includes(kind) ||
      !(await viewTargetExists(kind, entityId))
    ) {
      return json({ ok: false }, { revalidate: [] });
    }
    await logActionEvent({
      eventType: `${kind}.view`,
      entityType: kind,
      entityId,
    });
    // Refresh only the sidebar list; a bare action would refetch every query.
    return json({ ok: true }, { revalidate: [fetchRecentItems.key] });
  },
  "recents-log-view",
);
