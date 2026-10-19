import {
  ONE_DAY_MS,
  ONE_HOUR_MS,
  ONE_MONTH_MS,
  ONE_WEEK_MS,
  ONE_YEAR_MS,
} from "./time";

const BUCKETS = [
  { label: "Last hour", maxAgeMs: ONE_HOUR_MS },
  { label: "Last day", maxAgeMs: ONE_DAY_MS },
  { label: "Last week", maxAgeMs: ONE_WEEK_MS },
  { label: "Last month", maxAgeMs: ONE_MONTH_MS },
  { label: "Last year", maxAgeMs: ONE_YEAR_MS },
  { label: "Older", maxAgeMs: Number.POSITIVE_INFINITY },
];

export function groupByUpdatedAt<T extends { updatedAt: string }>(
  items: T[],
  nowMs: number = Date.now(),
): { label: string; items: T[] }[] {
  const groups = BUCKETS.map((b) => ({ label: b.label, items: [] as T[] }));
  for (const d of items) {
    const age = nowMs - new Date(d.updatedAt).getTime();
    const index = BUCKETS.findIndex((b) => age <= b.maxAgeMs);
    groups[index < 0 ? groups.length - 1 : index].items.push(d);
  }
  return groups;
}
