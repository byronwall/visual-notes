const DAY_MS = 24 * 60 * 60_000;

/** Whole days until `iso`, never below zero. */
export const daysUntil = (iso: string, now = Date.now()) =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - now) / DAY_MS));

export const deletesInLabel = (iso: string, now = Date.now()) => {
  const days = daysUntil(iso, now);
  return days <= 1 ? "deletes within a day" : `deletes in ${days} days`;
};

const REASON_VERBS: Record<string, string> = {
  distill: "distilled into",
  combine: "combined into",
  post_event: "summarized into",
  make_task: "turned into a task",
  delete: "marked for deletion",
  manual: "archived",
};

/** "distilled into" etc.; callers append the target title when there is one. */
export const reasonVerb = (reason: string | null) =>
  REASON_VERBS[reason ?? "manual"] ?? "archived";

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
