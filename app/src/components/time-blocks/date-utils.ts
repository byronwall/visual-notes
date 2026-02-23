export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

export const startOfMonth = (date: Date) => {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const endOfMonth = (date: Date) => {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  next.setHours(23, 59, 59, 999);
  return next;
};

export const startOfYear = (date: Date) => {
  const next = new Date(date.getFullYear(), 0, 1);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const endOfYear = (date: Date) => {
  const next = new Date(date.getFullYear(), 11, 31);
  next.setHours(23, 59, 59, 999);
  return next;
};

export const formatWeekdayShort = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);

export const formatWeekdayLong = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);

export const formatMonthDay = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);

export const formatDateOnly = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const formatTime12 = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

export const formatTime24 = (date: Date) => {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

export const parseDateInput = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const parseTimeInput = (value: string) => {
  const [hoursRaw, minutesRaw] = value.split(":").map(Number);
  const hours = Number.isFinite(hoursRaw) ? hoursRaw : 0;
  const minutes = Number.isFinite(minutesRaw) ? minutesRaw : 0;
  return {
    hours: Math.max(0, Math.min(23, hours)),
    minutes: Math.max(0, Math.min(59, minutes)),
  };
};

export const setDateTimeFromInputs = (
  date: Date,
  dateInputValue: string,
  timeInputValue: string
) => {
  const parsedDate = parseDateInput(dateInputValue);
  const base = parsedDate ?? new Date(date);
  const { hours, minutes } = parseTimeInput(timeInputValue);
  base.setHours(hours, minutes, 0, 0);
  return base;
};

export const durationMinutes = (start: Date, end: Date) =>
  Math.max(0, Math.round((end.getTime() - start.getTime()) / MS_PER_MINUTE));
