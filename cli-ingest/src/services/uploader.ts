import { ExportedNote } from "../types";
import { sha256Hex } from "./hash";

export function planUploads(
  exported: ExportedNote[],
  // TODO: import type from elsewhere
  inventory: Record<string, { contentHash: string | null; updatedAt: string }>
) {
  const withHashes = exported.map((n) => ({ n, hash: sha256Hex(n.markdown) }));
  const reasons: Record<string, number> = {
    new: 0,
    changed: 0,
    "server-missing-hash": 0,
    unchanged: 0,
  };
  const candidates: { note: ExportedNote; hash: string }[] = [];
  for (const { n, hash } of withHashes) {
    const inv = inventory[n.id];
    let reason = "unchanged";
    if (!inv) reason = "new";
    else if (!inv.contentHash) reason = "server-missing-hash";
    else if (inv.contentHash !== hash) reason = "changed";
    reasons[reason] = (reasons[reason] || 0) + 1;
    if (reason !== "unchanged") candidates.push({ note: n, hash });
  }
  return { candidates, reasons };
}

export async function postBatches(
  serverUrl: string,
  sourceTag: string,
  candidates: { note: ExportedNote; hash: string }[],
  batchSize: number,
  fetchImpl = globalThis.fetch,
  log: (m: string) => void
) {
  // TODO: don't pass around fetchImpl - just call fetch directly.
  if (!fetchImpl) throw new Error("global fetch unavailable; use Node 18+");
  // TODO: build a URL helper and call that -- or store fixed Record<string, string> for endpoints.
  const endpoint = serverUrl.replace(/\/?$/, "") + "/api/docs";
  let ok = 0,
    fail = 0;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    log(
      `Uploading batch ${i / batchSize + 1}/${Math.ceil(
        candidates.length / batchSize
      )}`
    );
    for (const { note, hash } of batch) {
      try {
        // TODO: build a simple fetch helper that does get/post simply.
        const res = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: note.title || "(untitled)",
            markdown: note.markdown,
            originalSource: sourceTag,
            originalContentId: note.id,
            contentHash: hash,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        ok++;
      } catch (e) {
        fail++;
        log(`  -> failed: ${(e as Error).message}`);
      }
    }
  }
  return { ok, fail };
}
