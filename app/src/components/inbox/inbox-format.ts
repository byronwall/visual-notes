import type { InboxPlace, NeedsYouReason } from "~/lib/annotations/inbox-types";

export const REASON_LABEL: Record<NeedsYouReason, string> = {
  ready: "Ready for review",
  "agent-reply": "Agent replied",
  "agent-note": "Agent note",
  proposal: "Suggested edits",
  research: "Research comment resolved",
};

export const placeHref = (place: InboxPlace) =>
  place.kind === "task"
    ? `/tasks?list=${place.listId}`
    : `/docs/${place.docId}${place.blockId ? `#b-${place.blockId}` : ""}`;

/** "5m", "3h", "2d" before `nowMs`; dates past a week. */
export function ago(iso: string, nowMs: number): string {
  const ms = nowMs - Date.parse(iso);
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 8) return `${days}d`;
  return new Date(iso).toISOString().slice(0, 10);
}
