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

export function formatTimestampUtc(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").replace("Z", " UTC");
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
