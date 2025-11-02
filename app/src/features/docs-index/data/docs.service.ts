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
export type SourcesResponse = { total: number; sources: { originalSource: string; count: number }[] };

export async function fetchDocs(q: { pathPrefix?: string; metaKey?: string; metaValue?: string; take?: number }) {
  const params = new URLSearchParams();
  if (q.pathPrefix) params.set("pathPrefix", q.pathPrefix);
  if (q.metaKey) params.set("metaKey", q.metaKey);
  if (q.metaValue) params.set("metaValue", q.metaValue);
  params.set("take", String(q.take ?? 8000));
  const res = await apiFetch(`/api/docs${params.toString() ? `?${params}` : ""}`);
  if (!res.ok) throw new Error("Failed to load notes");
  const { items } = (await res.json()) as { items: DocListItem[] };
  return items;
}

export async function searchDocs(q: { q: string; pathPrefix?: string; metaKey?: string; metaValue?: string; take?: number; signal?: AbortSignal }) {
  const params = new URLSearchParams({ q: q.q, take: String(q.take ?? 50) });
  if (q.pathPrefix) params.set("pathPrefix", q.pathPrefix);
  if (q.metaKey) params.set("metaKey", q.metaKey);
  if (q.metaValue) params.set("metaValue", q.metaValue);
  const res = await apiFetch(`/api/docs/search?${params}`, { signal: q.signal });
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
  const res = await apiFetch(`/api/docs/source?originalSource=${encodeURIComponent(source)}`, { method: "DELETE" });
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


