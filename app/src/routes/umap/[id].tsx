import {
  type VoidComponent,
  For,
  Show,
  createResource,
  createSignal,
  createEffect,
  onCleanup,
} from "solid-js";
import { useParams, useNavigate, A } from "@solidjs/router";
import { apiFetch } from "~/utils/base-url";

type Point = { docId: string; x: number; y: number; z?: number | null };
type RunMeta = {
  id: string;
  dims: number;
  params?: Record<string, unknown> | null;
  embeddingRunId: string;
  createdAt: string;
  count?: number;
};

async function fetchRun(id: string): Promise<RunMeta> {
  const res = await apiFetch(`/api/umap/runs/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("Failed to load run");
  return (await res.json()) as any;
}

async function fetchPoints(
  id: string
): Promise<{ points: Point[]; dims: number }> {
  const res = await apiFetch(
    `/api/umap/points?runId=${encodeURIComponent(id)}`
  );
  if (!res.ok) throw new Error("Failed to load points");
  const json = (await res.json()) as { points: Point[]; dims: number };
  return json;
}

async function deleteRun(id: string) {
  const res = await apiFetch(`/api/umap/runs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete run");
}

const UmapDetail: VoidComponent = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [meta] = createResource(() => params.id, fetchRun);
  const [data, { refetch }] = createResource(() => params.id, fetchPoints);
  const [busy, setBusy] = createSignal(false);
  const [canvasWidth, setCanvasWidth] = createSignal(800);
  const [canvasHeight, setCanvasHeight] = createSignal(420);
  let canvasEl: HTMLCanvasElement | undefined;
  let canvasContainerEl: HTMLDivElement | undefined;
  let ro: ResizeObserver | undefined;

  createEffect(() => {
    if (!canvasContainerEl) return;
    if (typeof window === "undefined") return;
    // Observe container size to make canvas responsive
    ro?.disconnect();
    ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = entry.contentBoxSize?.[0] || entry.contentRect;
        const w = Math.max(
          320,
          Math.floor((box as any).inlineSize || entry.contentRect.width)
        );
        const h = Math.max(
          200,
          Math.floor((box as any).blockSize || entry.contentRect.height || 0)
        );
        // Maintain a 2:1 aspect if height not present
        const height = h > 0 ? h : Math.floor(w / 2);
        setCanvasWidth(w);
        setCanvasHeight(height);
      }
    });
    ro.observe(canvasContainerEl);
  });

  onCleanup(() => {
    ro?.disconnect();
  });

  createEffect(() => {
    const d = data();
    const pts = d?.points || [];
    const dims = d?.dims || 2;
    const w = canvasWidth();
    const h = canvasHeight();
    if (!canvasEl) return;
    if (!w || !h) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    // Set canvas internal size for crisp rendering
    canvasEl.width = Math.floor(w * dpr);
    canvasEl.height = Math.floor(h * dpr);
    canvasEl.style.width = `${w}px`;
    canvasEl.style.height = `${h}px`;
    ctx.reset?.();
    if (dpr !== 1) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.clearRect(0, 0, w, h);

    if (pts.length === 0) {
      // empty state
      ctx.fillStyle = "#6b7280"; // gray-500
      ctx.font = "12px ui-sans-serif, system-ui, -apple-system";
      ctx.fillText("No points to display", 12, 20);
      return;
    }

    // Compute bounds
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (p.z != null) {
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
      }
    }
    if (!Number.isFinite(minZ)) {
      minZ = 0;
      maxZ = 1;
    }
    // Avoid zero range
    const pad = 12;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const sx = (w - pad * 2) / rangeX;
    const sy = (h - pad * 2) / rangeY;

    // Draw frame
    ctx.strokeStyle = "#e5e7eb"; // gray-200
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // Draw points
    const baseColor = "#2563eb"; // blue-600
    for (const p of pts) {
      const px = pad + (p.x - minX) * sx;
      // invert y for canvas
      const py = h - pad - (p.y - minY) * sy;
      let color = baseColor;
      if (dims === 3 && p.z != null && Number.isFinite(p.z)) {
        const t = (p.z - minZ) / (maxZ - minZ || 1);
        const light = 40 + Math.floor(t * 40); // 40-80
        color = `hsl(220 90% ${light}%)`;
      }
      ctx.fillStyle = color;
      const r = 2;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4 space-y-6">
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <h1 class="text-2xl font-bold">UMAP Run</h1>
            <Show when={meta()}>
              {(m) => (
                <div class="text-sm text-gray-600">
                  <div>
                    <span class="font-medium">ID:</span> {m().id}
                  </div>
                  <div>
                    <span class="font-medium">Dims:</span> {m().dims}D
                  </div>
                  <div>
                    <span class="font-medium">Embedding Run:</span>{" "}
                    <A
                      href={`/embeddings/${m().embeddingRunId}`}
                      class="text-blue-600 hover:underline"
                    >
                      {m().embeddingRunId.slice(0, 10)}
                    </A>
                  </div>
                  <div>
                    <span class="font-medium">Created:</span>{" "}
                    {new Date(m().createdAt).toLocaleString()}
                  </div>
                  <div class="mt-2">
                    <span class="font-medium">Params:</span>
                    <Show
                      when={
                        m().params && Object.keys(m().params || {}).length > 0
                      }
                      fallback={<span class="ml-1 text-gray-500">(none)</span>}
                    >
                      <div class="mt-1 overflow-hidden rounded border border-gray-200">
                        <table class="w-full text-xs">
                          <thead class="bg-gray-50">
                            <tr>
                              <th class="text-left p-2">Key</th>
                              <th class="text-left p-2">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            <For
                              each={Object.entries(
                                (m().params as Record<string, unknown>) || {}
                              )}
                            >
                              {([k, v]) => (
                                <tr class="border-t border-gray-200">
                                  <td class="p-2 font-mono">{k}</td>
                                  <td class="p-2">
                                    {typeof v === "object"
                                      ? JSON.stringify(v)
                                      : String(v)}
                                  </td>
                                </tr>
                              )}
                            </For>
                          </tbody>
                        </table>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </Show>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
              disabled={busy()}
              onClick={async () => {
                if (!confirm("Delete this UMAP run?")) return;
                try {
                  setBusy(true);
                  await deleteRun(params.id);
                  navigate("/umap");
                } catch (e) {
                  console.error(e);
                  alert("Failed to delete run");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete Run
            </button>
          </div>
        </div>

        <Show when={data()} fallback={<p>Loading points…</p>}>
          {(d) => (
            <div class="space-y-4">
              <div class="rounded border border-gray-200">
                <div class="flex items-center justify-between px-3 py-2">
                  <div class="text-sm text-gray-600">
                    {d().points.length} points ({d().dims}D)
                  </div>
                </div>
                <div
                  ref={(el) => (canvasContainerEl = el)}
                  class="w-full"
                  style={{ height: "360px" }}
                >
                  <canvas ref={(el) => (canvasEl = el)} />
                </div>
              </div>

              <div class="overflow-hidden rounded border border-gray-200">
                <table class="w-full text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="text-left p-2">Doc</th>
                      <th class="text-left p-2">x</th>
                      <th class="text-left p-2">y</th>
                      <th class="text-left p-2">z</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={d().points.slice(0, 50)}>
                      {(p) => (
                        <tr class="border-t border-gray-200">
                          <td class="p-2 font-mono text-xs">
                            <A
                              href={`/docs/${p.docId}`}
                              class="text-blue-600 hover:underline"
                            >
                              {p.docId.slice(0, 10)}
                            </A>
                          </td>
                          <td class="p-2">{p.x.toFixed(2)}</td>
                          <td class="p-2">{p.y.toFixed(2)}</td>
                          <td class="p-2">
                            {p.z != null ? p.z.toFixed(2) : "-"}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
                <div class="px-2 py-1 text-xs text-gray-500">
                  Showing first 50 points.
                </div>
              </div>
            </div>
          )}
        </Show>

        <A href="/umap" class="text-blue-600 hover:underline text-sm">
          ← Back to UMAP
        </A>
      </div>
    </main>
  );
};

export default UmapDetail;
