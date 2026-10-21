import { action, json } from "@solidjs/router";
import { logActionEvent } from "~/server/events/action-events";
import { fetchRecentItems } from "./recents.queries";
import { RECENT_KINDS, type RecentViewKind } from "./recents.types";

const VIEW_KINDS = RECENT_KINDS.filter((kind) => kind !== "note");

/** Records a visit to a collection, research topic, tag, or path page. */
export const logRecentView = action(
  async (kind: RecentViewKind, id: string) => {
    "use server";
    const entityId = String(id || "").trim();
    // Server actions accept any payload; notes log `doc.view` themselves.
    if (!entityId || !VIEW_KINDS.includes(kind)) {
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
