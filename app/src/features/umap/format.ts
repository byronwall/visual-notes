import type { UmapInit, UmapMetric } from "~/features/umap/types";

export function parseMetric(v: string): UmapMetric {
  return v === "euclidean" ? "euclidean" : "cosine";
}

export function parseInit(v: string): UmapInit {
  return v === "random" ? "random" : "spectral";
}

export function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

export function parseNumberOrUndefined(v: string): number | undefined {
  const trimmed = v.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

export function parseIntOrUndefined(v: string): number | undefined {
  const trimmed = v.trim();
  if (trimmed === "") return undefined;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function formatRelativeTimestamp(iso: string, nowMs = Date.now()): string {
  const timestampMs = new Date(iso).getTime();
  if (!Number.isFinite(timestampMs)) return iso;

  const deltaMs = timestampMs - nowMs;
  const absMs = Math.abs(deltaMs);
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const weekMs = 7 * dayMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;

  if (absMs < minuteMs) return "just now";

  const plural = (value: number, unit: string) =>
    `${value}${unit}${value === 1 ? "" : "s"}`;
  const ago = (value: number, unit: string) => `${plural(value, unit)} ago`;
  const inTime = (value: number, unit: string) => `in ${plural(value, unit)}`;
  const render = (value: number, unit: string) =>
    deltaMs < 0 ? ago(value, unit) : inTime(value, unit);

  if (absMs < hourMs) return render(Math.floor(absMs / minuteMs), "m");
  if (absMs < dayMs) return render(Math.floor(absMs / hourMs), "h");
  if (absMs < weekMs) return render(Math.floor(absMs / dayMs), "d");
  if (absMs < monthMs) return render(Math.floor(absMs / weekMs), "w");
  if (absMs < yearMs) return render(Math.floor(absMs / monthMs), "mo");
  return render(Math.floor(absMs / yearMs), "y");
}

export function formatParamValue(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function getParamEntries(
  params?: Record<string, unknown> | null
): [string, unknown][] {
  return Object.entries(params ?? {}).sort(([a], [b]) => a.localeCompare(b));
}
