import { apiFetch } from "~/utils/base-url";
import type { DocItem, UmapPoint, UmapRun } from "~/types/notes";

export async function fetchDocs(): Promise<DocItem[]> {
  const res = await apiFetch("/api/docs?take=8000");
  if (!res.ok) throw new Error("Failed to load docs");
  const json = (await res.json()) as { items: DocItem[] };
  const items = json.items || [];
  try {
    console.log(`[services] fetchDocs: loaded ${items.length} docs`);
  } catch {}
  return items;
}

export async function fetchLatestUmapRun(): Promise<UmapRun | undefined> {
  const res = await apiFetch("/api/umap/runs");
  if (!res.ok) return undefined;
  const json = (await res.json()) as { runs: UmapRun[] };
  const run = json.runs?.[0];
  try {
    if (run)
      console.log(
        `[services] fetchLatestUmapRun: id=${run.id} dims=${run.dims}`
      );
  } catch {}
  return run;
}

export async function fetchUmapPoints(runId: string): Promise<UmapPoint[]> {
  const res = await apiFetch(
    `/api/umap/points?runId=${encodeURIComponent(runId)}`
  );
  if (!res.ok) throw new Error("Failed to load UMAP points");
  const json = (await res.json()) as { points: UmapPoint[] };
  const points = json.points || [];
  try {
    console.log(
      `[services] fetchUmapPoints: runId=${runId} count=${points.length}`
    );
  } catch {}
  return points;
}

export async function updateDocTitle(
  id: string,
  title: string
): Promise<{ id: string; updatedAt: string }> {
  const res = await apiFetch(`/api/docs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))) as any;
    throw new Error(msg?.error || "Failed to update title");
  }
  const json = (await res.json()) as { id: string; updatedAt: string };
  try {
    console.log(
      `[services] updateDocTitle: id=${json.id} updatedAt=${json.updatedAt}`
    );
  } catch {}
  return json;
}
