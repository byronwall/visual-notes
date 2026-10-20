import type {
  CollectionProperty,
  CollectionRow,
  DateValue,
  PropertyConfig,
  PropertyKind,
  PropertyValue,
  SelectOption,
} from "./types";
import { TITLE_PROPERTY_ID } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export const isComputedKind = (kind: PropertyKind) =>
  kind === "created_time" || kind === "updated_time";

export const isDateString = (value: unknown): boolean =>
  typeof value === "string" &&
  (DATE_RE.test(value) || DATETIME_RE.test(value)) &&
  !Number.isNaN(Date.parse(value.length === 10 ? `${value}T00:00` : value));

export const isDateValue = (value: unknown): value is DateValue => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (!isDateString(v.start)) return false;
  if (v.end === undefined || v.end === null) return true;
  return isDateString(v.end) && String(v.end) >= String(v.start);
};

export const optionById = (config: PropertyConfig, id: unknown) =>
  typeof id === "string"
    ? (config.options ?? []).find((o) => o.id === id)
    : undefined;

export const optionByName = (config: PropertyConfig, name: string) => {
  const needle = name.trim().toLowerCase();
  return (config.options ?? []).find(
    (o) => o.name.trim().toLowerCase() === needle,
  );
};

export type ValidationResult =
  | { ok: true; value: PropertyValue }
  | { ok: false; error: string };

/** Validates a stored value against a property. `null` always clears. */
export function validateValue(
  property: Pick<CollectionProperty, "kind" | "config" | "name">,
  value: unknown,
): ValidationResult {
  if (value === null || value === undefined) return { ok: true, value: null };
  const fail = (error: string): ValidationResult => ({
    ok: false,
    error: `${property.name}: ${error}`,
  });
  switch (property.kind) {
    case "text":
      if (typeof value !== "string") return fail("expected text");
      if (value.length > 10_000) return fail("text is too long");
      return { ok: true, value: value.length ? value : null };
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value))
        return fail("expected a number");
      if (property.config.format === "rating") {
        const max = property.config.ratingMax ?? 5;
        if (value < 0 || value > max || !Number.isInteger(value))
          return fail(`rating must be a whole number from 0 to ${max}`);
      }
      return { ok: true, value };
    case "select":
    case "status":
      if (!optionById(property.config, value)) return fail("unknown option");
      return { ok: true, value: value as string };
    case "multi_select": {
      if (!Array.isArray(value)) return fail("expected a list of options");
      const unique = [...new Set(value)];
      if (unique.some((id) => !optionById(property.config, id)))
        return fail("unknown option");
      return { ok: true, value: unique.length ? (unique as string[]) : null };
    }
    case "date":
      if (!isDateValue(value)) return fail("expected a date");
      return {
        ok: true,
        value: value.end
          ? { start: value.start, end: value.end }
          : { start: value.start },
      };
    case "checkbox":
      if (typeof value !== "boolean") return fail("expected true or false");
      return { ok: true, value: value || null };
    case "created_time":
    case "updated_time":
      return fail("this property is read-only");
  }
}

export const isEmptyValue = (value: PropertyValue | undefined) =>
  value === null ||
  value === undefined ||
  value === "" ||
  value === false ||
  (Array.isArray(value) && value.length === 0);

/** Reads a row's value for a property, including computed and title values. */
export function readValue(
  row: CollectionRow,
  property: Pick<CollectionProperty, "id" | "kind">,
): PropertyValue {
  if (property.id === TITLE_PROPERTY_ID) return row.title;
  if (property.kind === "created_time")
    return { start: isoToWallClock(row.createdAt) };
  if (property.kind === "updated_time")
    return { start: isoToWallClock(row.updatedAt) };
  return row.properties[property.id] ?? null;
}

/** Converts an ISO timestamp to local wall-clock `YYYY-MM-DDTHH:mm`. */
export function isoToWallClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export const datePart = (value: string) => value.slice(0, 10);

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
];

export function formatDateString(value: string, includeTime = true): string {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return value;
  const base = `${MONTHS[m - 1]} ${d}, ${y}`;
  if (!includeTime || value.length <= 10) return base;
  const [hh, mm] = value.slice(11, 16).split(":").map(Number);
  const suffix = hh >= 12 ? "PM" : "AM";
  const hour = hh % 12 === 0 ? 12 : hh % 12;
  return `${base} ${hour}:${String(mm).padStart(2, "0")} ${suffix}`;
}

export function formatNumber(value: number, config: PropertyConfig): string {
  const decimals = config.decimals;
  switch (config.format) {
    case "percent":
      return `${(value * 100).toFixed(decimals ?? 0)}%`;
    case "currency":
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: config.currency || "USD",
          minimumFractionDigits: decimals ?? 2,
          maximumFractionDigits: decimals ?? 2,
        }).format(value);
      } catch {
        return value.toFixed(decimals ?? 2);
      }
    case "decimal":
      return value.toFixed(decimals ?? 2);
    case "progress":
      return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
    case "rating":
      return `${value}/${config.ratingMax ?? 5}`;
    default:
      return Number.isInteger(value)
        ? String(value)
        : String(Number(value.toFixed(6)));
  }
}

/** Plain-text rendering, used for search, exports, and the MCP header. */
export function formatValueText(
  property: Pick<CollectionProperty, "kind" | "config">,
  value: PropertyValue,
): string {
  if (value === null || value === undefined) return "";
  switch (property.kind) {
    case "text":
      return String(value);
    case "number":
      return typeof value === "number"
        ? formatNumber(value, property.config)
        : "";
    case "select":
    case "status":
      return optionById(property.config, value)?.name ?? "";
    case "multi_select":
      return Array.isArray(value)
        ? value
            .map((id) => optionById(property.config, id)?.name)
            .filter(Boolean)
            .join(", ")
        : "";
    case "date":
    case "created_time":
    case "updated_time": {
      if (!isDateValue(value)) return "";
      const showTime =
        property.kind !== "date" || Boolean(property.config.includeTime);
      const start = formatDateString(value.start, showTime);
      return value.end
        ? `${start} → ${formatDateString(value.end, showTime)}`
        : start;
    }
    case "checkbox":
      return value === true ? "Yes" : "No";
  }
}

const TRUE_WORDS = new Set([
  "true",
  "yes",
  "y",
  "1",
  "x",
  "done",
  "checked",
  "✓",
]);
const FALSE_WORDS = new Set(["false", "no", "n", "0", "", "unchecked"]);

/**
 * Parses loose text (meta values, pasted cells, type changes) into a value.
 * Select-like kinds resolve names to option ids; unknown names are returned in
 * `newOptions` so the caller can create them.
 */
export function parseLooseText(
  property: Pick<CollectionProperty, "kind" | "config">,
  raw: string,
): { value: PropertyValue; newOptions: string[]; failed: boolean } {
  const text = raw.trim();
  const none = { value: null, newOptions: [], failed: false };
  if (!text) return none;
  switch (property.kind) {
    case "text":
      return { value: text, newOptions: [], failed: false };
    case "number": {
      const cleaned = text.replace(/[$,\s]/g, "");
      const pct = cleaned.endsWith("%");
      const n = Number(pct ? cleaned.slice(0, -1) : cleaned);
      if (!Number.isFinite(n))
        return { value: null, newOptions: [], failed: true };
      let value = pct ? n / 100 : n;
      if (property.config.format === "rating") {
        const max = property.config.ratingMax ?? 5;
        value = Math.max(0, Math.min(max, Math.round(value)));
      }
      return { value, newOptions: [], failed: false };
    }
    case "select":
    case "status": {
      const opt = optionByName(property.config, text);
      return opt
        ? { value: opt.id, newOptions: [], failed: false }
        : { value: null, newOptions: [text], failed: false };
    }
    case "multi_select": {
      const names = text
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const ids: string[] = [];
      const newOptions: string[] = [];
      for (const name of names) {
        const opt = optionByName(property.config, name);
        if (opt) ids.push(opt.id);
        else newOptions.push(name);
      }
      return { value: ids.length ? ids : null, newOptions, failed: false };
    }
    case "date": {
      const [startRaw, endRaw] = text.split(/\s*(?:→|->|–)\s*/);
      const start = parseLooseDate(startRaw);
      if (!start) return { value: null, newOptions: [], failed: true };
      const end = endRaw ? parseLooseDate(endRaw) : null;
      return {
        value: end && end >= start ? { start, end } : { start },
        newOptions: [],
        failed: false,
      };
    }
    case "checkbox": {
      const lower = text.toLowerCase();
      if (TRUE_WORDS.has(lower))
        return { value: true, newOptions: [], failed: false };
      if (FALSE_WORDS.has(lower)) return none;
      return { value: null, newOptions: [], failed: true };
    }
    case "created_time":
    case "updated_time":
      return none;
  }
}

export function parseLooseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (isDateString(String(text))) return text;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(text)) {
    const candidate = `${text.slice(0, 10)}T${text.slice(11, 16)}`;
    return isDateString(candidate) ? candidate : null;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return isoToWallClock(parsed.toISOString()).slice(0, 10);
}

/** Converts a value from one property shape to another during a type change. */
export function coerceValue(
  from: Pick<CollectionProperty, "kind" | "config">,
  to: Pick<CollectionProperty, "kind" | "config">,
  value: PropertyValue,
): { value: PropertyValue; newOptions: string[]; lost: boolean } {
  if (value === null || value === undefined)
    return { value: null, newOptions: [], lost: false };
  // Select ↔ status ↔ multi-select keep option ids when options carry over.
  const selectLike = (k: PropertyKind) => k === "select" || k === "status";
  if (
    selectLike(from.kind) &&
    to.kind === "multi_select" &&
    typeof value === "string"
  )
    return {
      value: optionById(to.config, value) ? [value] : null,
      newOptions: [],
      lost: !optionById(to.config, value),
    };
  if (
    from.kind === "multi_select" &&
    selectLike(to.kind) &&
    Array.isArray(value)
  ) {
    const first = value.find((id) => optionById(to.config, id));
    return {
      value: first ?? null,
      newOptions: [],
      lost: value.length > 1 || !first,
    };
  }
  if (
    selectLike(from.kind) &&
    selectLike(to.kind) &&
    typeof value === "string"
  ) {
    const ok = Boolean(optionById(to.config, value));
    return { value: ok ? value : null, newOptions: [], lost: !ok };
  }
  if (from.kind === "date" && to.kind === "date")
    return { value, newOptions: [], lost: false };
  const text = formatValueText(from, value);
  const parsed = parseLooseText(
    to,
    from.kind === "number" ? String(value) : text,
  );
  return {
    value: parsed.value,
    newOptions: parsed.newOptions,
    lost:
      parsed.failed ||
      (parsed.value === null && parsed.newOptions.length === 0 && text !== ""),
  };
}

export const findOption = (options: SelectOption[] | undefined, id: string) =>
  (options ?? []).find((o) => o.id === id);
