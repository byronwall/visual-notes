import { ONE_DAY_MS, ONE_HOUR_MS, ONE_MONTH_MS, ONE_WEEK_MS, ONE_YEAR_MS } from "./time";

export type DocListItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  path?: string | null;
  meta?: Record<string, unknown> | null;
};

export function groupByUpdatedAt(items: DocListItem[], nowMs: number = Date.now()) {
  const now = nowMs;

  const buckets: Record<string, DocListItem[]> = {
    hour: [],
    day: [],
    week: [],
    month: [],
    year: [],
    older: [],
  };

  for (const d of items) {
    const t = new Date(d.updatedAt).getTime();
    const dt = now - t;
    if (dt <= ONE_HOUR_MS) buckets.hour.push(d);
    else if (dt <= ONE_DAY_MS) buckets.day.push(d);
    else if (dt <= ONE_WEEK_MS) buckets.week.push(d);
    else if (dt <= ONE_MONTH_MS) buckets.month.push(d);
    else if (dt <= ONE_YEAR_MS) buckets.year.push(d);
    else buckets.older.push(d);
  }

  return [
    { label: "Last hour", items: buckets.hour },
    { label: "Last day", items: buckets.day },
    { label: "Last week", items: buckets.week },
    { label: "Last month", items: buckets.month },
    { label: "Last year", items: buckets.year },
    { label: "Older", items: buckets.older },
  ];
}

