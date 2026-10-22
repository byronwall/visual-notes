import { ONE_DAY_MS, ONE_HOUR_MS, ONE_WEEK_MS } from "./time";

export type UpdatedBucket = { key: string; label: string };

const ROLLING = [
  { key: "hour", label: "Last hour", maxAgeMs: ONE_HOUR_MS },
  { key: "day", label: "Last 24 hours", maxAgeMs: ONE_DAY_MS },
  { key: "week", label: "Last 7 days", maxAgeMs: ONE_WEEK_MS },
  { key: "month", label: "Last 30 days", maxAgeMs: 30 * ONE_DAY_MS },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Recent notes fall into rolling windows; older ones into calendar months for
 * the past year, then whole years. Months use UTC so the server and client
 * render the same headings.
 */
export function updatedBucket(
  updatedAt: string | number,
  nowMs: number,
): UpdatedBucket {
  const t = typeof updatedAt === "number" ? updatedAt : Date.parse(updatedAt);
  const age = nowMs - t;
  for (const b of ROLLING) if (age <= b.maxAgeMs) return b;
  const d = new Date(t);
  const now = new Date(nowMs);
  const monthsAgo =
    (now.getUTCFullYear() - d.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - d.getUTCMonth());
  if (monthsAgo < 12) {
    const year = d.getUTCFullYear();
    const label = MONTHS[d.getUTCMonth()];
    return {
      key: `m-${year}-${d.getUTCMonth()}`,
      label: year === now.getUTCFullYear() ? label : `${label} ${year}`,
    };
  }
  return { key: `y-${d.getUTCFullYear()}`, label: String(d.getUTCFullYear()) };
}

/** Groups items in order, keeping each bucket where its first item appears. */
export function groupByUpdatedAt<T extends { updatedAt: string }>(
  items: T[],
  nowMs: number,
): (UpdatedBucket & { items: T[] })[] {
  const groups: (UpdatedBucket & { items: T[] })[] = [];
  const byKey = new Map<string, UpdatedBucket & { items: T[] }>();
  for (const item of items) {
    const bucket = updatedBucket(item.updatedAt, nowMs);
    let group = byKey.get(bucket.key);
    if (!group) {
      group = { ...bucket, items: [] };
      byKey.set(bucket.key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}
