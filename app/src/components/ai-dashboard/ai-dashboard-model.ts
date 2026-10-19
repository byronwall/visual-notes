export type RunStatus = "SUCCESS" | "ERROR" | "PARTIAL";

export type DashboardPrompt = {
  id: string;
  task: string;
  description?: string | null;
  defaultModel: string;
  defaultTemp: number;
  defaultTopP?: number | null;
  activeVersion?: {
    id: string;
    template: string;
    system?: string | null;
  } | null;
};

export type DashboardRun = {
  id: string;
  status: RunStatus;
  model: string;
  createdAt: string;
  error?: string | null;
  outputHtml?: string | null;
  promptId?: string | null;
  promptTask?: string | null;
};

export type PromptRunStats = {
  count: number;
  failed: number;
  lastRunAt: string | null;
};

export type RunStatusFilter = "ALL" | RunStatus;

export const RUN_STATUS_FILTERS: { value: RunStatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SUCCESS", label: "Succeeded" },
  { value: "ERROR", label: "Failed" },
  { value: "PARTIAL", label: "Partial" },
];

export const parseRunStatusFilter = (value: string | undefined): RunStatusFilter =>
  value === "SUCCESS" || value === "ERROR" || value === "PARTIAL" ? value : "ALL";

export const statsByPrompt = (runs: DashboardRun[]) => {
  const map = new Map<string, PromptRunStats>();
  for (const run of runs) {
    if (!run.promptId) continue;
    const stats = map.get(run.promptId) ?? { count: 0, failed: 0, lastRunAt: null };
    stats.count += 1;
    if (run.status === "ERROR") stats.failed += 1;
    if (!stats.lastRunAt || run.createdAt > stats.lastRunAt) stats.lastRunAt = run.createdAt;
    map.set(run.promptId, stats);
  }
  return map;
};

export const previewText = (html: string | null | undefined, max = 140) => {
  if (!html) return "";
  const text = html
    .replace(/<\/(p|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

export const runMatchesQuery = (run: DashboardRun, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${run.id} ${run.promptTask ?? ""} ${run.model} ${run.error ?? ""}`
    .toLowerCase()
    .includes(q);
};
