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
