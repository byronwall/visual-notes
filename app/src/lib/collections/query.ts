import { compareRank } from "./rank";
import type {
  CollectionProperty,
  CollectionRow,
  FilterCondition,
  FilterGroup,
  FilterOperator,
  FilterTree,
  PropertyKind,
  PropertyValue,
  SortRule,
  ViewConfig,
} from "./types";
import { TITLE_PROPERTY_ID } from "./types";
import {
  datePart,
  formatValueText,
  isDateValue,
  isEmptyValue,
  optionById,
  readValue,
} from "./values";

/** The title pseudo property, so the engine can treat it like any text column. */
export const TITLE_PROPERTY: CollectionProperty = {
  id: TITLE_PROPERTY_ID,
  name: "Name",
  kind: "text",
  config: {},
  position: -1,
};

export const withTitle = (properties: CollectionProperty[]) => [
  TITLE_PROPERTY,
  ...properties,
];

const TEXT_OPS: FilterOperator[] = [
  "contains",
  "not_contains",
  "is",
  "is_not",
  "starts_with",
  "is_empty",
  "is_not_empty",
];
const NUMBER_OPS: FilterOperator[] = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "is_empty",
  "is_not_empty",
];
const SELECT_OPS: FilterOperator[] = [
  "is",
  "is_not",
  "any_of",
  "none_of",
  "is_empty",
  "is_not_empty",
];
const STATUS_OPS: FilterOperator[] = ["group_is", ...SELECT_OPS];
const MULTI_OPS: FilterOperator[] = [
  "any_of",
  "contains_all",
  "none_of",
  "is_empty",
  "is_not_empty",
];
const DATE_OPS: FilterOperator[] = [
  "is",
  "before",
  "after",
  "on_or_before",
  "on_or_after",
  "past_days",
  "next_days",
  "this_week",
  "this_month",
  "is_empty",
  "is_not_empty",
];

export const operatorsFor = (kind: PropertyKind): FilterOperator[] => {
  switch (kind) {
    case "text":
      return TEXT_OPS;
    case "number":
      return NUMBER_OPS;
    case "select":
      return SELECT_OPS;
    case "status":
      return STATUS_OPS;
    case "multi_select":
      return MULTI_OPS;
    case "date":
    case "created_time":
    case "updated_time":
      return DATE_OPS;
    case "checkbox":
      return ["is_checked", "is_unchecked"];
  }
};

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: "contains",
  not_contains: "does not contain",
  is: "is",
  is_not: "is not",
  starts_with: "starts with",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  eq: "=",
  neq: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  any_of: "is any of",
  none_of: "is none of",
  contains_all: "has all of",
  group_is: "group is",
  before: "is before",
  after: "is after",
  on_or_before: "is on or before",
  on_or_after: "is on or after",
  past_days: "is within past days",
  next_days: "is within next days",
  this_week: "is this week",
  this_month: "is this month",
  is_checked: "is checked",
  is_unchecked: "is unchecked",
};

/** Operators that take no value input. */
export const operatorTakesValue = (op: FilterOperator) =>
  ![
    "is_empty",
    "is_not_empty",
    "this_week",
    "this_month",
    "is_checked",
    "is_unchecked",
  ].includes(op);

const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
};

const weekday = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
};

export const startOfWeek = (day: string) => addDays(day, -weekday(day));
export { addDays as addDaysToDate };

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : typeof v === "string"
      ? [v]
      : [];

function matchCondition(
  row: CollectionRow,
  condition: FilterCondition,
  propsById: Map<string, CollectionProperty>,
  today: string,
): boolean {
  const property = propsById.get(condition.propertyId);
  // Conditions on deleted properties are ignored rather than hiding everything.
  if (!property) return true;
  const value = readValue(row, property);
  const op = condition.op;
  if (op === "is_empty") return isEmptyValue(value);
  if (op === "is_not_empty") return !isEmptyValue(value);
  const target = condition.value;
  switch (property.kind) {
    case "text": {
      const hay = String(value ?? "").toLowerCase();
      const needle = String(target ?? "").toLowerCase();
      if (op === "contains") return hay.includes(needle);
      if (op === "not_contains") return !hay.includes(needle);
      if (op === "is") return hay === needle;
      if (op === "is_not") return hay !== needle;
      if (op === "starts_with") return hay.startsWith(needle);
      return true;
    }
    case "number": {
      if (target === undefined || target === null || target === "") return true;
      const t = Number(target);
      if (typeof value !== "number") return op === "neq";
      if (op === "eq") return value === t;
      if (op === "neq") return value !== t;
      if (op === "gt") return value > t;
      if (op === "gte") return value >= t;
      if (op === "lt") return value < t;
      if (op === "lte") return value <= t;
      return true;
    }
    case "select":
    case "status": {
      const ids = asStringArray(target);
      if (op === "group_is") {
        const group = optionById(property.config, value)?.group;
        return ids.length === 0 || (group !== undefined && ids.includes(group));
      }
      if (ids.length === 0) return true;
      const has = typeof value === "string" && ids.includes(value);
      if (op === "is" || op === "any_of") return has;
      if (op === "is_not" || op === "none_of") return !has;
      return true;
    }
    case "multi_select": {
      const ids = asStringArray(target);
      if (ids.length === 0) return true;
      const values = asStringArray(value);
      if (op === "any_of") return ids.some((id) => values.includes(id));
      if (op === "contains_all") return ids.every((id) => values.includes(id));
      if (op === "none_of") return !ids.some((id) => values.includes(id));
      return true;
    }
    case "date":
    case "created_time":
    case "updated_time": {
      if (!isDateValue(value)) return false;
      const start = datePart(value.start);
      const end = value.end ? datePart(value.end) : start;
      const t = typeof target === "string" ? datePart(target) : "";
      const n = Math.max(0, Math.floor(Number(target) || 0));
      switch (op) {
        case "is":
          return t ? start <= t && t <= end : true;
        case "before":
          return t ? start < t : true;
        case "after":
          return t ? end > t : true;
        case "on_or_before":
          return t ? start <= t : true;
        case "on_or_after":
          return t ? end >= t : true;
        case "past_days":
          return end >= addDays(today, -n) && start <= today;
        case "next_days":
          return end >= today && start <= addDays(today, n);
        case "this_week": {
          const ws = startOfWeek(today);
          return end >= ws && start <= addDays(ws, 6);
        }
        case "this_month": {
          const month = today.slice(0, 7);
          return start.slice(0, 7) <= month && end.slice(0, 7) >= month;
        }
        default:
          return true;
      }
    }
    case "checkbox":
      if (op === "is_checked") return value === true;
      if (op === "is_unchecked") return value !== true;
      return true;
  }
}

const isGroup = (item: FilterCondition | FilterGroup): item is FilterGroup =>
  "conditions" in item;

export function matchesFilter(
  row: CollectionRow,
  filter: FilterTree | undefined,
  propsById: Map<string, CollectionProperty>,
  today: string,
): boolean {
  if (!filter || filter.items.length === 0) return true;
  const test = (item: FilterCondition | FilterGroup): boolean => {
    if (!isGroup(item)) return matchCondition(row, item, propsById, today);
    if (item.conditions.length === 0) return true;
    return item.conjunction === "and"
      ? item.conditions.every((c) => matchCondition(row, c, propsById, today))
      : item.conditions.some((c) => matchCondition(row, c, propsById, today));
  };
  return filter.conjunction === "and"
    ? filter.items.every(test)
    : filter.items.some(test);
}

/** Sort key for one value; `null` sorts last regardless of direction. */
function sortKey(
  property: CollectionProperty,
  value: PropertyValue,
): string | number | null {
  if (isEmptyValue(value) && property.kind !== "checkbox") return null;
  switch (property.kind) {
    case "number":
      return typeof value === "number" ? value : null;
    case "checkbox":
      return value === true ? 1 : 0;
    case "select":
    case "status": {
      // Option order, so status sorts To do → Doing → Done as configured.
      const options = property.config.options ?? [];
      const index = options.findIndex((o) => o.id === value);
      return index < 0 ? null : index;
    }
    case "date":
    case "created_time":
    case "updated_time":
      return isDateValue(value) ? value.start : null;
    default:
      return formatValueText(property, value).toLowerCase();
  }
}

const compareKeys = (a: string | number | null, b: string | number | null) => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
};

export function sortRows(
  rows: CollectionRow[],
  sorts: SortRule[] | undefined,
  propsById: Map<string, CollectionProperty>,
): CollectionRow[] {
  const rules = (sorts ?? []).filter((s) => propsById.has(s.propertyId));
  return [...rows].sort((a, b) => {
    for (const rule of rules) {
      const property = propsById.get(rule.propertyId)!;
      const ka = sortKey(property, readValue(a, property));
      const kb = sortKey(property, readValue(b, property));
      if (ka === null || kb === null) {
        const c = compareKeys(ka, kb);
        if (c !== 0) return c;
        continue;
      }
      const c = compareKeys(ka, kb);
      if (c !== 0) return rule.direction === "asc" ? c : -c;
    }
    const byRank = compareRank(a.rank, b.rank);
    if (byRank !== 0) return byRank;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function matchesSearch(
  row: CollectionRow,
  search: string | undefined,
  properties: CollectionProperty[],
) {
  const needle = search?.trim().toLowerCase();
  if (!needle) return true;
  if (row.title.toLowerCase().includes(needle)) return true;
  return properties.some((p) =>
    formatValueText(p, readValue(row, p)).toLowerCase().includes(needle),
  );
}

/** Filters, searches, and sorts rows for a view. Pure; runs on server and client. */
export function applyView(
  rows: CollectionRow[],
  properties: CollectionProperty[],
  config: ViewConfig,
  today: string,
): CollectionRow[] {
  const propsById = new Map(withTitle(properties).map((p) => [p.id, p]));
  const filtered = rows.filter(
    (row) =>
      matchesFilter(row, config.filter, propsById, today) &&
      matchesSearch(row, config.search, properties),
  );
  return sortRows(filtered, config.sorts, propsById);
}

/** True when the view has an active sort, so manual reordering is disabled. */
export const hasActiveSort = (config: ViewConfig) =>
  (config.sorts ?? []).length > 0;

/** Visible properties for a view, in display order (title excluded). */
export function orderedProperties(
  properties: CollectionProperty[],
  config: ViewConfig,
  { includeHidden = false } = {},
): CollectionProperty[] {
  const order = config.propertyOrder ?? [];
  const index = (p: CollectionProperty) => {
    const i = order.indexOf(p.id);
    return i < 0 ? order.length + p.position : i;
  };
  const hidden = new Set(config.hiddenProperties ?? []);
  return [...properties]
    .sort((a, b) => index(a) - index(b))
    .filter((p) => includeHidden || !hidden.has(p.id));
}
