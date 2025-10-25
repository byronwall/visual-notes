import { NoteExternalId, NoteUpdatedAt } from "../io/skipIndex";

export type ServerInventoryItem = {
  originalContentId: NoteExternalId;
  contentHash?: string | null;
  updatedAt: NoteUpdatedAt;
};

export async function fetchInventory(
  serverUrl: string,
  sourceTag: string,
  fetchImpl = globalThis.fetch
) {
  // TODO: don't pass around fetchImpl - just call fetch directly.
  if (!fetchImpl) throw new Error("global fetch unavailable; use Node 18+");
  const url =
    serverUrl.replace(/\/?$/, "") +
    `/api/docs/inventory?source=${encodeURIComponent(sourceTag)}`;
  const res = await fetchImpl(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Inventory HTTP ${res.status}`);
  const map: Record<string, { contentHash: string | null; updatedAt: string }> =
    {};
  for (const it of Array.isArray(json.items)
    ? (json.items as ServerInventoryItem[])
    : []) {
    map[it.originalContentId] = {
      contentHash: it.contentHash ?? null,
      updatedAt: String(it.updatedAt),
    };
  }
  return map;
}
