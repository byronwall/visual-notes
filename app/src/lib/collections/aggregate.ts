import type {
  Aggregation,
  CollectionProperty,
  CollectionRow,
  PropertyKind,
} from "./types";
import { formatNumber, isEmptyValue, readValue } from "./values";

export const AGGREGATION_LABELS: Record<Aggregation, string> = {
  none: "None",
  count: "Count all",
  count_empty: "Count empty",
  count_not_empty: "Count not empty",
  percent_not_empty: "Percent not empty",
  sum: "Sum",
  avg: "Average",
  min: "Min",
  max: "Max",
  checked: "Checked",
  percent_checked: "Percent checked",
};

/** Aggregations that make sense for a property kind, in menu order. */
export function aggregationsFor(kind: PropertyKind): Aggregation[] {
  const common: Aggregation[] = [
    "none",
    "count",
    "count_empty",
    "count_not_empty",
    "percent_not_empty",
  ];
  if (kind === "number") return [...common, "sum", "avg", "min", "max"];
  if (kind === "checkbox")
    return ["none", "count", "checked", "percent_checked"];
  return common;
}

/** Computes a footer value as display text, or "" for `none`. */
export function aggregate(
  rows: CollectionRow[],
  property: CollectionProperty,
  kind: Aggregation,
): string {
  if (kind === "none") return "";
  const values = rows.map((r) => readValue(r, property));
  const total = values.length;
  const filled = values.filter((v) => !isEmptyValue(v)).length;
  const pct = (n: number) =>
    total === 0 ? "0%" : `${Math.round((n / total) * 100)}%`;
  switch (kind) {
    case "count":
      return String(total);
    case "count_empty":
      return String(total - filled);
    case "count_not_empty":
      return String(filled);
    case "percent_not_empty":
      return pct(filled);
    case "checked":
      return String(values.filter((v) => v === true).length);
    case "percent_checked":
      return pct(values.filter((v) => v === true).length);
    case "sum":
    case "avg":
    case "min":
    case "max": {
      const nums = values.filter((v): v is number => typeof v === "number");
      if (nums.length === 0) return "—";
      const value =
        kind === "sum"
          ? nums.reduce((a, b) => a + b, 0)
          : kind === "avg"
            ? nums.reduce((a, b) => a + b, 0) / nums.length
            : kind === "min"
              ? Math.min(...nums)
              : Math.max(...nums);
      // Ratings and progress average to fractions; show them as plain numbers.
      const config =
        property.config.format === "rating" ||
        property.config.format === "progress"
          ? {
              ...property.config,
              format:
                property.config.format === "progress"
                  ? ("percent" as const)
                  : ("decimal" as const),
              decimals: 1,
            }
          : kind === "avg" && (property.config.format ?? "plain") === "plain"
            ? { ...property.config, format: "decimal" as const, decimals: 2 }
            : property.config;
      return formatNumber(value, config);
    }
  }
}
