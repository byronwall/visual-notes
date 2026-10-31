import { addDaysToKey, weekdayOfKey } from "./taskFormat";

type ParsedTaskTitle = {
  description: string;
  tags: string[];
};

export type ParsedTaskInput = ParsedTaskTitle & {
  /** `YYYY-MM-DD` when an `@due` token was present, otherwise undefined. */
  dueDate?: string;
  /** Minutes when a `~duration` token was present, otherwise undefined. */
  durationMinutes?: number;
};

const TITLE_TAG_PATTERN = /(^|\s)#([A-Za-z0-9][A-Za-z0-9/_-]*)/g;
const DUE_PATTERN = /(^|\s)@([A-Za-z0-9-]+)(?=\s|$)/g;
const DURATION_PATTERN = /(^|\s)~(\d+(?:\.\d+)?)(h|m)?(?:(\d+)m)?(?=\s|$)/gi;

const WEEKDAY_NAMES: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

export const resolveDueToken = (token: string, todayKey: string): string | null => {
  const value = token.toLowerCase();
  if (value === "today" || value === "tod") return todayKey;
  if (value === "tomorrow" || value === "tom") return addDaysToKey(todayKey, 1);
  if (value === "next-week" || value === "nextweek") {
    const offset = ((8 - weekdayOfKey(todayKey)) % 7) || 7;
    return addDaysToKey(todayKey, offset);
  }
  if (value in WEEKDAY_NAMES) {
    const offset = ((WEEKDAY_NAMES[value] - weekdayOfKey(todayKey) + 7) % 7) || 7;
    return addDaysToKey(todayKey, offset);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
};

const toMinutes = (amount: string, unit: string | undefined, extraMinutes?: string) => {
  const base = Number(amount);
  const minutes =
    unit?.toLowerCase() === "h" ? base * 60 + Number(extraMinutes ?? 0) : base;
  const rounded = Math.round(minutes);
  return rounded >= 1 ? rounded : null;
};

export const formatTaskTitle = (description: string, tags: string[]) => {
  const trimmedDescription = description.trim();
  const normalizedTags = tags.map((tag) => tag.trim()).filter(Boolean);

  if (normalizedTags.length === 0) return trimmedDescription;
  if (!trimmedDescription) {
    return normalizedTags.map((tag) => `#${tag}`).join(" ");
  }

  return `${trimmedDescription} ${normalizedTags.map((tag) => `#${tag}`).join(" ")}`;
};

export const parseTaskTitle = (value: string): ParsedTaskTitle => {
  const tags: string[] = [];
  const seen = new Set<string>();

  const description = value
    .replace(TITLE_TAG_PATTERN, (_match, prefix: string, rawTag: string) => {
      const normalizedTag = rawTag.trim();
      const dedupeKey = normalizedTag.toLowerCase();
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        tags.push(normalizedTag);
      }
      return prefix;
    })
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return {
    description,
    tags,
  };
};

/**
 * Parses a quick-add line: `#tags`, an `@due` token (today, tomorrow, a
 * weekday, next-week, or YYYY-MM-DD) and a `~duration` token (30m, 1h, 1h30m).
 * Unrecognized `@words` stay in the description.
 */
export const parseTaskInput = (value: string, todayKey: string): ParsedTaskInput => {
  let dueDate: string | undefined;
  let durationMinutes: number | undefined;

  const withoutDue = value.replace(DUE_PATTERN, (match, prefix: string, token: string) => {
    const resolved = resolveDueToken(token, todayKey);
    if (!resolved) return match;
    dueDate = resolved;
    return prefix;
  });

  const withoutDuration = withoutDue.replace(
    DURATION_PATTERN,
    (match, prefix: string, amount: string, unit?: string, extra?: string) => {
      const minutes = toMinutes(amount, unit, extra);
      if (minutes === null) return match;
      durationMinutes = minutes;
      return prefix;
    }
  );

  const parsed = parseTaskTitle(withoutDuration);
  return { ...parsed, dueDate, durationMinutes };
};
