import { apiFetch } from "~/utils/base-url";

export type MetaRecord = Record<string, string | number | boolean | null>;
export type DocListItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  path?: string | null;
  meta?: MetaRecord | null;
};
export type ServerSearchItem = DocListItem & { snippet?: string | null };
export type SourcesResponse = {
  total: number;
  sources: { originalSource: string; count: number }[];
};

export async function fetchDocs(q: {
  pathPrefix?: string;
  pathBlankOnly?: boolean;
  metaKey?: string;
  metaValue?: string;
  source?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  take?: number;
}) {
  const params = new URLSearchParams();
  if (q.pathPrefix) params.set("pathPrefix", q.pathPrefix);
  if (q.pathBlankOnly) params.set("pathBlankOnly", "1");
  if (q.metaKey) params.set("metaKey", q.metaKey);
  if (q.metaValue) params.set("metaValue", q.metaValue);
  if (q.source) params.set("source", q.source);
  if (q.createdFrom) params.set("createdFrom", toIsoDateStart(q.createdFrom));
  if (q.createdTo) params.set("createdTo", toIsoDateEnd(q.createdTo));
  if (q.updatedFrom) params.set("updatedFrom", toIsoDateStart(q.updatedFrom));
  if (q.updatedTo) params.set("updatedTo", toIsoDateEnd(q.updatedTo));
  params.set("take", String(q.take ?? 8000));
  const res = await apiFetch(
    `/api/docs${params.toString() ? `?${params}` : ""}`
  );
  if (!res.ok) throw new Error("Failed to load notes");
  const { items } = (await res.json()) as { items: DocListItem[] };
  return items;
}

export async function searchDocs(q: {
  q: string;
  pathPrefix?: string;
  pathBlankOnly?: boolean;
  metaKey?: string;
  metaValue?: string;
  source?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  take?: number;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({ q: q.q, take: String(q.take ?? 50) });
  if (q.pathPrefix) params.set("pathPrefix", q.pathPrefix);
  if (q.pathBlankOnly) params.set("pathBlankOnly", "1");
  if (q.metaKey) params.set("metaKey", q.metaKey);
  if (q.metaValue) params.set("metaValue", q.metaValue);
  if (q.source) params.set("source", q.source);
  if (q.createdFrom) params.set("createdFrom", toIsoDateStart(q.createdFrom));
  if (q.createdTo) params.set("createdTo", toIsoDateEnd(q.createdTo));
  if (q.updatedFrom) params.set("updatedFrom", toIsoDateStart(q.updatedFrom));
  if (q.updatedTo) params.set("updatedTo", toIsoDateEnd(q.updatedTo));
  const res = await apiFetch(`/api/docs/search?${params}`, {
    signal: q.signal,
  });
  if (!res.ok) throw new Error("Failed to search notes");
  const { items } = (await res.json()) as { items: ServerSearchItem[] };
  return items ?? [];
}

export async function fetchSources(): Promise<SourcesResponse> {
  const res = await apiFetch("/api/docs/sources");
  if (!res.ok) throw new Error("Failed to load sources");
  const json = (await res.json()) as SourcesResponse;
  return json;
}

export async function deleteAllDocs() {
  const res = await apiFetch("/api/docs", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete all notes");
}

export async function deleteBySource(source: string) {
  const res = await apiFetch(
    `/api/docs/source?originalSource=${encodeURIComponent(source)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Failed to delete notes by source");
}

export async function bulkSetSource(value: string) {
  const res = await apiFetch("/api/docs/source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ originalSource: value }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({} as any));
    throw new Error((json as any).error || "Failed to set source on notes");
  }
}

export async function processPathRound(): Promise<{
  ok: boolean;
  updated: number;
  failed: number;
  considered: number;
  init?: number;
  extend?: number;
}> {
  const res = await apiFetch("/api/docs/path-round", { method: "POST" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({} as any));
    throw new Error((json as any).error || "Failed to process path round");
  }
  const json = (await res.json().catch(() => ({}))) as any;
  return json as any;
}

export type ScanRelativeImagesResult = {
  ok: boolean;
  total: number;
  considered: number;
  matches: number;
  updated?: number;
  failed?: number;
  dryRun?: boolean;
};

export async function scanRelativeImages(options?: {
  dryRun?: boolean;
}): Promise<ScanRelativeImagesResult> {
  const params = new URLSearchParams();
  if (options?.dryRun) params.set("dryRun", "1");
  const url = `/api/docs/scan-relative-images${
    params.toString() ? `?${params}` : ""
  }`;
  const res = await apiFetch(url, { method: "POST" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({} as any));
    throw new Error(
      (json as any).error || "Failed to scan notes for relative images"
    );
  }
  const json = (await res.json().catch(() => ({}))) as ScanRelativeImagesResult;
  try {
    console.log("[services] scanRelativeImages:", json);
  } catch {}
  return json;
}

export async function bulkDeleteDocs(ids: string[]) {
  const res = await apiFetch("/api/docs/bulk-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({} as any));
    throw new Error((json as any).error || "Failed to bulk delete notes");
  }
}

function toIsoDateStart(dateOnly: string): string {
  // dateOnly is YYYY-MM-DD
  const d = new Date(dateOnly + "T00:00:00");
  return d.toISOString();
}

function toIsoDateEnd(dateOnly: string): string {
  const d = new Date(dateOnly + "T23:59:59.999");
  return d.toISOString();
}
