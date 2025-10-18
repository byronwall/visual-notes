import {
  type VoidComponent,
  For,
  Show,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  createEffect,
  createMemo,
} from "solid-js";
import SidePanel from "../components/SidePanel";
import { apiFetch } from "~/utils/base-url";

type DocItem = { id: string; title: string; createdAt: string };
type UmapPoint = { docId: string; x: number; y: number; z?: number | null };
type UmapRun = { id: string; dims: number };
type FullDoc = { id: string; title: string; html: string };

const SPREAD = 1000;
const isBrowser = typeof window !== "undefined";

async function fetchDocs(): Promise<DocItem[]> {
  const res = await apiFetch("/api/docs?take=500");
  if (!res.ok) throw new Error("Failed to load docs");
  const json = (await res.json()) as { items: DocItem[] };
  return json.items || [];
}

async function fetchLatestUmapRun(): Promise<UmapRun | undefined> {
  const res = await apiFetch("/api/umap/runs");
  if (!res.ok) return undefined;
  const json = (await res.json()) as { runs: UmapRun[] };
  return json.runs?.[0];
}

async function fetchUmapPoints(runId: string): Promise<UmapPoint[]> {
  const res = await apiFetch(
    `/api/umap/points?runId=${encodeURIComponent(runId)}`
  );
  if (!res.ok) throw new Error("Failed to load UMAP points");
  const json = (await res.json()) as { points: UmapPoint[] };
  return json.points || [];
}

async function fetchDoc(id: string): Promise<FullDoc> {
  const res = await apiFetch(`/api/docs/${id}`);
  if (!res.ok) throw new Error("Failed to load doc");
  return (await res.json()) as FullDoc;
}

function hashString(input: string): number {
  // Simple 32-bit FNV-1a hash
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash =
      (hash +
        ((hash << 1) +
          (hash << 4) +
          (hash << 7) +
          (hash << 8) +
          (hash << 24))) >>>
      0;
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function seededPositionFor(
  title: string,
  index: number
): { x: number; y: number } {
  const base = `${title}\u0000${index}`;
  const seed = hashString(base);
  const rnd = mulberry32(seed);
  // Map to roughly a circle, then scale out to a generous plane
  const angle = rnd() * Math.PI * 2;
  const radius = Math.sqrt(rnd());
  const x = Math.cos(angle) * radius * SPREAD;
  const y = Math.sin(angle) * radius * SPREAD;
  return { x, y };
}

function colorFor(title: string): string {
  const h = hashString(title);
  const hue = h % 360;
  const sat = 55 + (h % 20); // 55–74
  const light = 55; // fixed for readability
  return `hsl(${hue} ${sat}% ${light}%)`;
}

const VisualCanvas: VoidComponent = () => {
  const [docs] = createResource(fetchDocs);
  const [umapRun] = createResource(fetchLatestUmapRun);
  const [umapPoints] = createResource(async () => {
    const run = await fetchLatestUmapRun();
    if (!run) return [] as UmapPoint[];
    return fetchUmapPoints(run.id);
  });
  const [selectedId, setSelectedId] = createSignal<string | undefined>(
    undefined
  );
  const [selectedDoc] = createResource(selectedId, (id) =>
    id ? fetchDoc(id) : Promise.resolve(undefined as unknown as FullDoc)
  );

  // Pan/zoom state
  const [scale, setScale] = createSignal(1);
  const [offset, setOffset] = createSignal({ x: 0, y: 0 });
  const [navHeight, setNavHeight] = createSignal(56);
  const [isPanning, setIsPanning] = createSignal(false);
  let lastPan = { x: 0, y: 0 };
  let frame = 0 as number | undefined;
  let containerEl: HTMLDivElement | undefined;

  // Build a normalized index of UMAP positions mapped into a consistent world space
  const umapIndex = createMemo(() => {
    const pts = umapPoints();
    if (!pts || pts.length === 0)
      return new Map<string, { x: number; y: number }>();

    // Compute bounding box
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    // Scale to fit within [-SPREAD, SPREAD] while preserving aspect ratio
    const safeWidth = width === 0 ? 1 : width;
    const safeHeight = height === 0 ? 1 : height;
    const scale = Math.min((2 * SPREAD) / safeWidth, (2 * SPREAD) / safeHeight);

    const map = new Map<string, { x: number; y: number }>();
    for (const p of pts) {
      const nx = (p.x - cx) * scale;
      const ny = (p.y - cy) * scale;
      map.set(p.docId, { x: nx, y: ny });
    }
    try {
      console.log(
        `[visual] UMAP normalization: bbox min=(${minX.toFixed(
          2
        )}, ${minY.toFixed(2)}) max=(${maxX.toFixed(2)}, ${maxY.toFixed(
          2
        )}), span=(${(maxX - minX).toFixed(2)}, ${(maxY - minY).toFixed(
          2
        )}), scale=${scale.toFixed(3)}; points=${pts.length}`
      );
      const preview = pts.slice(0, Math.min(5, pts.length)).map((p) => ({
        docId: p.docId,
        src: { x: p.x, y: p.y },
        norm: map.get(p.docId),
      }));
      console.log(`[visual] UMAP sample (first ${preview.length})`, preview);
    } catch {}
    return map;
  });

  function applyTransform() {
    if (!containerEl) return;
    const t = offset();
    const s = scale();
    containerEl.style.transform = `translate(${t.x}px, ${t.y}px) scale(${s})`;
  }

  function scheduleTransform() {
    if (!isBrowser) return;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = undefined as unknown as number;
      applyTransform();
    });
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY;
    const zoomIntensity = 0.0015; // smaller = slower zoom
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const currentScale = scale();
    const newScale = Math.min(
      4,
      Math.max(0.2, currentScale * Math.pow(2, -delta * zoomIntensity))
    );

    const t = offset();
    // Zoom towards the mouse position (screen-space to world-space adjustment)
    const worldXBefore = mouseX - t.x;
    const worldYBefore = mouseY - t.y;
    const worldXAfter = worldXBefore * (newScale / currentScale);
    const worldYAfter = worldYBefore * (newScale / currentScale);
    const dx = worldXBefore - worldXAfter;
    const dy = worldYBefore - worldYAfter;

    setScale(newScale);
    setOffset({ x: t.x + dx, y: t.y + dy });
    scheduleTransform();
  }

  function onPointerDown(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsPanning(true);
    lastPan = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPanning()) return;
    const dx = e.clientX - lastPan.x;
    const dy = e.clientY - lastPan.y;
    lastPan = { x: e.clientX, y: e.clientY };
    const t = offset();
    setOffset({ x: t.x + dx, y: t.y + dy });
    scheduleTransform();
  }

  function onPointerUp(e: PointerEvent) {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    setIsPanning(false);
  }

  function measureNav() {
    const nav = document.querySelector("nav");
    const h = nav
      ? Math.round((nav as HTMLElement).getBoundingClientRect().height)
      : 56;
    setNavHeight(h);
  }

  function fitToSpread() {
    if (!isBrowser) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const availH = Math.max(100, vh - navHeight());
    const s = (0.9 * Math.min(vw, availH)) / (2 * SPREAD);
    const screenCx = vw / 2;
    const screenCy = navHeight() + availH / 2;
    setScale(Math.max(0.2, Math.min(2, s)));
    setOffset({ x: screenCx, y: screenCy });
    scheduleTransform();
  }

  onMount(() => {
    measureNav();
    // Center the origin initially under navbar
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setOffset({ x: vw / 2, y: navHeight() + (vh - navHeight()) / 2 });
    scheduleTransform();
    window.addEventListener("resize", () => {
      measureNav();
      scheduleTransform();
    });
  });

  createEffect(() => {
    const list = docs();
    if (list) {
      console.log(`[visual] loaded ${list.length} notes`);
      const sample = list.slice(0, Math.min(5, list.length));
      console.log(
        "[visual] sample positions",
        sample.map((d, i) => ({
          id: d.id,
          title: d.title,
          pos: seededPositionFor(d.title, i),
        }))
      );
      if (isBrowser && list.length > 0) fitToSpread();
    }
  });

  // Log UMAP run and points loaded
  createEffect(() => {
    const run = umapRun();
    if (run) {
      console.log(`[visual] UMAP run loaded id=${run.id} dims=${run.dims}`);
    }
  });

  createEffect(() => {
    const pts = umapPoints();
    if (pts) {
      console.log(`[visual] UMAP points loaded: ${pts.length}`);
    }
  });

  // Log coordinate source summary
  createEffect(() => {
    const list = docs();
    if (!list) return;
    const index = umapIndex();
    let usedUmap = 0;
    let usedSeed = 0;
    for (const d of list) {
      if (index.has(d.id)) usedUmap++;
      else usedSeed++;
    }
    const sample = list.slice(0, Math.min(10, list.length)).map((d, i) => {
      const fromUmap = index.get(d.id);
      return {
        id: d.id,
        title: d.title,
        source: fromUmap ? "umap" : "seed",
        pos: fromUmap ?? seededPositionFor(d.title, i),
      };
    });
    console.log(
      `[visual] coordinate sources → umap=${usedUmap}, seeded=${usedSeed} (sample below)`
    );
    console.log(sample);
  });

  onCleanup(() => {
    if (isBrowser) {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleTransform);
    }
  });

  return (
    <main class="min-h-screen bg-white">
      <div
        class="fixed overflow-hidden bg-white"
        style={{
          position: "fixed",
          left: "0",
          right: "0",
          bottom: "0",
          top: `${navHeight()}px`,
        }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div
          ref={(el) => (containerEl = el)}
          style={{
            position: "absolute",
            left: "0px",
            top: "0px",
            transform: "translate(0px, 0px) scale(1)",
            "transform-origin": "0 0",
            "will-change": "transform",
          }}
        >
          <Show
            when={docs()}
            fallback={<div class="absolute left-4 top-4">Loading…</div>}
          >
            {(list) => (
              <For each={list()}>
                {(d, i) => {
                  const fromUmap = umapIndex().get(d.id);
                  const p = fromUmap ?? seededPositionFor(d.title, i());
                  const bg = colorFor(d.title);
                  return (
                    <button
                      type="button"
                      title={d.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(d.id);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{
                        position: "absolute",
                        left: `${p.x}px`,
                        top: `${p.y}px`,
                        transform: "translate(-50%, -50%)",
                        padding: "8px 10px",
                        background: bg,
                        color: "#111",
                        "border-radius": "8px",
                        border: "1px solid rgba(0,0,0,0.1)",
                        "box-shadow": "0 1px 2px rgba(0,0,0,0.08)",
                        "white-space": "nowrap",
                        "font-size": "12px",
                        "max-width": "320px",
                        "text-overflow": "ellipsis",
                        overflow: "hidden",
                        cursor: "pointer",
                      }}
                    >
                      {d.title}
                    </button>
                  );
                }}
              </For>
            )}
          </Show>
        </div>
      </div>
      <SidePanel open={!!selectedId()} onClose={() => setSelectedId(undefined)}>
        <Show
          when={selectedId()}
          fallback={<div class="text-sm text-gray-600">No note selected.</div>}
        >
          <Show
            when={selectedDoc()}
            fallback={<div class="p-2 text-sm text-gray-600">Loading…</div>}
          >
            {(doc) => (
              <article class="prose max-w-none">
                <h2 class="mt-0">{doc().title}</h2>
                <div innerHTML={doc().html} />
              </article>
            )}
          </Show>
        </Show>
      </SidePanel>
      <div
        class="fixed left-4 z-10 flex flex-col gap-2 bg-white/85 backdrop-blur border border-gray-200 rounded p-2 shadow"
        style={{ top: `${navHeight() + 12}px` }}
      >
        <div class="text-xs text-gray-700">Zoom: {scale().toFixed(2)}x</div>
        <div class="text-xs text-gray-700">
          Notes loaded: {docs()?.length || 0}
        </div>
        <div class="text-[11px] text-gray-500">Drag to pan, wheel to zoom</div>
        <div class="flex gap-2">
          <button class="cta" onClick={() => fitToSpread()}>
            Fit to Notes
          </button>
          <button
            class="cta"
            onClick={() => {
              const vw = window.innerWidth;
              const vh = window.innerHeight;
              setScale(1);
              setOffset({ x: vw / 2, y: navHeight() + (vh - navHeight()) / 2 });
              scheduleTransform();
            }}
          >
            Reset View
          </button>
        </div>
        {(docs()?.length || 0) === 0 && (
          <div class="text-[11px] text-gray-600">
            No notes yet. Ingest a note on the home page.
          </div>
        )}
      </div>
    </main>
  );
};

const VisualRoute: VoidComponent = () => {
  return <VisualCanvas />;
};

export default VisualRoute;
