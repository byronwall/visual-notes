import type { QueueItem } from "~/server/cleanup/queue";

const SOURCE_LABELS: Record<string, string> = {
  chatgpt_transcript: "ChatGPT",
  notion_import: "Notion import",
  agent: "Agent",
  user: "",
};

export const sourceLabel = (source: string) => SOURCE_LABELS[source] ?? "";

/** "May 2025" from an ISO date (YYYY-MM-DD). */
export const monthYear = (isoDate: string) =>
  new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

/** The second line of a queue row. */
export function queueMeta(item: QueueItem): string {
  if (item.regroup?.kind === "combine") {
    const count = item.regroup.members.length;
    return [`Combine ${count} notes`, item.path].filter(Boolean).join(" · ");
  }
  if (item.regroup?.kind === "move") {
    return `Unfiled · move to ${item.regroup.placement.label}`;
  }
  return [
    sourceLabel(item.source),
    monthYear(item.created),
    `${item.words.toLocaleString()} words`,
  ]
    .filter(Boolean)
    .join(" · ");
}
