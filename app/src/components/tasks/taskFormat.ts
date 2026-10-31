import type { TaskItem, TaskStatus } from "~/services/tasks/tasks.service";

export type DueTone = "overdue" | "today" | "soon" | "later" | "done";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const isDoneStatus = (status: TaskStatus) =>
  status === "complete" || status === "cancelled";

/** Local calendar date as `YYYY-MM-DD`, matching the due-date wire format. */
export const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const keyToUtc = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export const addDaysToKey = (key: string, days: number) => {
  const date = new Date(keyToUtc(key) + days * DAY_MS);
  return date.toISOString().slice(0, 10);
};

export const daysBetweenKeys = (fromKey: string, toKey: string) =>
  Math.round((keyToUtc(toKey) - keyToUtc(fromKey)) / DAY_MS);

export const weekdayOfKey = (key: string) => new Date(keyToUtc(key)).getUTCDay();

export const formatDue = (
  dueKey: string,
  todayKey: string,
  done = false
): { label: string; tone: DueTone; absolute: string } => {
  const diff = daysBetweenKeys(todayKey, dueKey);
  const date = new Date(keyToUtc(dueKey));
  const sameYear = dueKey.slice(0, 4) === todayKey.slice(0, 4);
  const absolute = `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}${
    sameYear ? "" : `, ${date.getUTCFullYear()}`
  }`;

  let label: string;
  if (diff === 0) label = "Today";
  else if (diff === 1) label = "Tomorrow";
  else if (diff === -1) label = "Yesterday";
  else if (diff < 0) label = `${-diff}d overdue`;
  else if (diff < 7) label = WEEKDAYS[date.getUTCDay()];
  else label = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;

  if (done && diff < 0) {
    label =
      diff === -1
        ? "Yesterday"
        : `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
  }

  const tone: DueTone = done
    ? "done"
    : diff < 0
      ? "overdue"
      : diff === 0
        ? "today"
        : diff < 7
          ? "soon"
          : "later";

  return { label, tone, absolute };
};

export type DueFilter = "overdue" | "today";

/** Whether an open task belongs to the overdue or due-today filter. */
export const matchesDueFilter = (
  task: TaskItem,
  filter: DueFilter,
  todayKey: string,
) => {
  if (isDoneStatus(task.status) || !task.dueDate) return false;
  const diff = daysBetweenKeys(todayKey, task.dueDate);
  return filter === "overdue" ? diff < 0 : diff === 0;
};

export const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
};

export type ListSummary = {
  open: number;
  done: number;
  overdue: number;
  dueToday: number;
  plannedMinutes: number;
};

export const summarizeTasks = (tasks: TaskItem[], todayKey: string): ListSummary => {
  const summary: ListSummary = {
    open: 0,
    done: 0,
    overdue: 0,
    dueToday: 0,
    plannedMinutes: 0,
  };
  for (const task of tasks) {
    if (isDoneStatus(task.status)) {
      summary.done += 1;
      continue;
    }
    summary.open += 1;
    summary.plannedMinutes += task.durationMinutes ?? 0;
    if (!task.dueDate) continue;
    const diff = daysBetweenKeys(todayKey, task.dueDate);
    if (diff < 0) summary.overdue += 1;
    else if (diff === 0) summary.dueToday += 1;
  }
  return summary;
};
