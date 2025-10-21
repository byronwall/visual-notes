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
import { normalizeAiOutputToHtml } from "~/server/lib/markdown";

type DocItem = { id: string; title: string; createdAt: string };
type UmapPoint = { docId: string; x: number; y: number; z?: number | null };
type UmapRun = { id: string; dims: number };
type FullDoc = { id: string; title: string; html?: string; markdown?: string };

const SPREAD = 1000;
const isBrowser = typeof window !== "undefined";

async function fetchDocs(): Promise<DocItem[]> {
  const res = await apiFetch("/api/docs?take=2000");
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
  const [umapRun, { refetch: refetchUmapRun }] =
    createResource(fetchLatestUmapRun);
  // Refetch points whenever the latest run id changes to avoid stale data after client navigation
  const [umapPoints, { refetch: refetchUmapPoints }] = createResource(
    () => umapRun()?.id,
    async (runId) => {
      if (!runId) return [] as UmapPoint[];
      return fetchUmapPoints(runId);
    }
  );
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
  // SVG elements
  let svgEl: SVGSVGElement | undefined;
  let gEl: SVGGElement | undefined;
  const [useUmap, setUseUmap] = createSignal(true);
  const [layoutVersion, setLayoutVersion] = createSignal(0);

  // Mouse tracking (screen and world space)
  const [mouseScreen, setMouseScreen] = createSignal({ x: 0, y: 0 });
  const mouseWorld = createMemo(() => {
    const s = scale();
    const t = offset();
    const m = mouseScreen();
    return { x: (m.x - t.x) / s, y: (m.y - t.y) / s };
  });

  // Click detection thresholds (element-relative screen space)
  const CLICK_TOL_PX = 5; // movement within this is considered a click, not a pan
  const CLICK_TOL_MS = 500; // optional time window for a click
  let clickStart: { x: number; y: number } | undefined;
  let clickStartTime = 0;

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

  // Compute final positions for all notes based on current layout preference
  const positions = createMemo(() => {
    const list = docs();
    const index = umapIndex();
    const preferUmap = useUmap();
    const map = new Map<string, { x: number; y: number }>();
    if (!list) return map;
    for (let i = 0; i < list.length; i++) {
      const d = list[i]!;
      const fromUmap = preferUmap ? index.get(d.id) : undefined;
      if (fromUmap) map.set(d.id, fromUmap);
      else map.set(d.id, seededPositionFor(d.title, i));
    }
    return map;
  });

  // SVG transform string
  const viewTransform = createMemo(() => {
    const t = offset();
    const s = scale();
    return `translate(${t.x}, ${t.y}) scale(${s})`;
  });

  function scheduleTransform() {
    if (!isBrowser) return;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = undefined as unknown as number;
      // No imperative DOM updates needed; Solid will reactively update viewTransform
    });
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY;
    const zoomIntensity = 0.0015; // smaller = slower zoom
    // Use element-relative mouse coordinates to avoid offset bugs
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

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
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    container.setPointerCapture(e.pointerId);
    setIsPanning(true);
    // Initialize pan anchor in element-relative coordinates for consistency
    lastPan = { x: localX, y: localY };
    // Ensure mouse position is current even if user doesn't move before release
    setMouseScreen({ x: localX, y: localY });
    // Track click candidate
    clickStart = { x: localX, y: localY };
    clickStartTime =
      typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  function onPointerMove(e: PointerEvent) {
    // Track element-relative mouse coordinates
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    setMouseScreen({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (!isPanning()) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const dx = localX - lastPan.x;
    const dy = localY - lastPan.y;
    lastPan = { x: localX, y: localY };
    const t = offset();
    setOffset({ x: t.x + dx, y: t.y + dy });
    scheduleTransform();
  }

  function onPointerUp(e: PointerEvent) {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    setIsPanning(false);
    // Detect bare click (minimal movement, short duration) to open nearest item
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    setMouseScreen({ x: localX, y: localY });
    if (clickStart) {
      const dx = localX - clickStart.x;
      const dy = localY - clickStart.y;
      const dist = Math.hypot(dx, dy);
      const dt =
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
        clickStartTime;
      if (
        (e as any).button === 0 &&
        dist <= CLICK_TOL_PX &&
        dt <= CLICK_TOL_MS
      ) {
        // Consistent with hover behavior: open only if hover label would show
        const canOpen = showHoverLabel();
        const id = hoveredDocId();
        if (canOpen && id) setSelectedId(id);
      }
    }
    clickStart = undefined;
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
      if (useUmap() && index.has(d.id)) usedUmap++;
      else usedSeed++;
    }
    const sample = list.slice(0, Math.min(10, list.length)).map((d, i) => {
      const fromUmap = useUmap() ? index.get(d.id) : undefined;
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

  // ---------- Spatial index (KD-Tree) for nearest lookup ----------
  type KDNode = {
    point: { x: number; y: number; id: string };
    left?: KDNode;
    right?: KDNode;
    axis: 0 | 1; // 0=x, 1=y
  };

  function buildKdTree(
    points: { x: number; y: number; id: string }[],
    depth = 0
  ): KDNode | undefined {
    if (points.length === 0) return undefined;
    const axis = (depth % 2) as 0 | 1;
    const sorted = points
      .slice()
      .sort((a, b) => (axis === 0 ? a.x - b.x : a.y - b.y));
    const median = Math.floor(sorted.length / 2);
    return {
      point: sorted[median]!,
      left: buildKdTree(sorted.slice(0, median), depth + 1),
      right: buildKdTree(sorted.slice(median + 1), depth + 1),
      axis,
    };
  }

  function kdNearest(
    root: KDNode | undefined,
    target: { x: number; y: number }
  ) {
    let bestId: string | undefined;
    let bestDist2 = Infinity;
    function sqr(n: number) {
      return n * n;
    }
    function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
      return sqr(a.x - b.x) + sqr(a.y - b.y);
    }
    function search(node: KDNode | undefined) {
      if (!node) return;
      const d2 = dist2(target, node.point);
      if (d2 < bestDist2) {
        bestDist2 = d2;
        bestId = node.point.id;
      }
      const axis = node.axis;
      const diff =
        axis === 0 ? target.x - node.point.x : target.y - node.point.y;
      const first = diff < 0 ? node.left : node.right;
      const second = diff < 0 ? node.right : node.left;
      search(first);
      if (sqr(diff) < bestDist2) search(second);
    }
    search(root);
    return { id: bestId, dist2: bestDist2 };
  }

  const kdTree = createMemo(() => {
    const list = docs();
    if (!list) return undefined as unknown as KDNode | undefined;
    const pos = positions();
    const pts: { x: number; y: number; id: string }[] = [];
    for (const d of list) {
      const p = pos.get(d.id);
      if (p) pts.push({ x: p.x, y: p.y, id: d.id });
    }
    return buildKdTree(pts);
  });

  // Nearest doc id to mouse
  const nearestToMouse = createMemo(() => {
    const root = kdTree();
    const m = mouseWorld();
    if (!root) return undefined as unknown as { id?: string; dist2?: number };
    return kdNearest(root, m);
  });

  const hoveredDocId = createMemo(() => nearestToMouse()?.id);
  const hoveredScreenDist = createMemo(() => {
    const d2 = nearestToMouse()?.dist2;
    if (d2 === undefined) return Infinity;
    const s = scale();
    return Math.sqrt(d2) * s; // convert world -> screen distance
  });

  // Show label only when cursor is reasonably close in screen space
  const showHoverLabel = createMemo(() => hoveredScreenDist() < 48);

  // Compute hovered label in SCREEN coordinates so it doesn't scale with zoom
  const hoveredLabelScreen = createMemo(() => {
    if (!showHoverLabel())
      return undefined as unknown as {
        x: number;
        y: number;
        title: string;
      };
    const id = hoveredDocId();
    if (!id)
      return undefined as unknown as { x: number; y: number; title: string };
    const pos = positions().get(id);
    if (!pos)
      return undefined as unknown as { x: number; y: number; title: string };
    const s = scale();
    const t = offset();
    const title = (docs() || []).find((d) => d.id === id)?.title || id;
    return { x: pos.x * s + t.x, y: pos.y * s + t.y, title };
  });

  // ---------- Left list pane: search and sorting ----------
  const [searchQuery, setSearchQuery] = createSignal("");
  const [sortMode, setSortMode] = createSignal<"proximity" | "title" | "date">(
    "proximity"
  );

  const filteredAndSortedDocs = createMemo(() => {
    const list = docs() || [];
    const q = searchQuery().trim().toLowerCase();
    const pos = positions();
    const m = mouseWorld();
    const sMode = sortMode();
    const filtered = q
      ? list.filter((d) => d.title.toLowerCase().includes(q))
      : list.slice();
    if (sMode === "title") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sMode === "date") {
      filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    } else {
      // proximity (default)
      function d2(id: string) {
        const p = pos.get(id);
        if (!p) return Number.POSITIVE_INFINITY;
        const dx = p.x - m.x;
        const dy = p.y - m.y;
        return dx * dx + dy * dy;
      }
      filtered.sort((a, b) => d2(a.id) - d2(b.id));
    }
    return filtered;
  });

  return (
    <main class="min-h-screen bg-white">
      {/* SVG infinite canvas */}
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
        <svg
          ref={(el) => (svgEl = el)}
          width="100%"
          height="100%"
          style={{ display: "block", background: "white" }}
        >
          <g ref={(el) => (gEl = el)} transform={viewTransform()}>
            <Show when={docs()}>
              {(list) => (
                <For each={list()}>
                  {(d, i) => {
                    const pos = createMemo(
                      () =>
                        positions().get(d.id) ?? seededPositionFor(d.title, i())
                    );
                    const fill = colorFor(d.title);
                    const isHovered = createMemo(
                      () => hoveredDocId() === d.id && showHoverLabel()
                    );
                    return (
                      <g>
                        <circle
                          cx={pos().x}
                          cy={pos().y}
                          r={10}
                          fill={fill}
                          stroke={isHovered() ? "#111" : "#00000020"}
                          stroke-width={isHovered() ? 2 : 1}
                          style={{ cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(d.id);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                        />
                        {/* Hover label now rendered as HTML overlay (constant size) */}
                      </g>
                    );
                  }}
                </For>
              )}
            </Show>
          </g>
        </svg>
        {/* Absolute-positioned hover label overlay in screen coordinates */}
        <Show when={hoveredLabelScreen()}>
          {(lbl) => (
            <div
              class="absolute"
              style={{
                left: `${lbl().x + 12}px`,
                top: `${lbl().y - 10}px`,
                "pointer-events": "none",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.98)",
                  border: "1px solid rgba(0,0,0,0.15)",
                  padding: "4px 8px",
                  "border-radius": "6px",
                  "box-shadow": "0 2px 6px rgba(0,0,0,0.08)",
                  color: "#111",
                  "font-size": "14px",
                  "max-width": "320px",
                  "white-space": "nowrap",
                  "text-overflow": "ellipsis",
                  overflow: "hidden",
                }}
              >
                {lbl().title}
              </div>
            </div>
          )}
        </Show>
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
                {(() => {
                  const html = normalizeAiOutputToHtml(
                    doc().markdown || doc().html || ""
                  );
                  console.log("Visual panel render", {
                    id: doc().id,
                    hasHtml: Boolean(doc().html),
                    hasMd: Boolean(doc().markdown),
                    preview: html.slice(0, 120),
                  });
                  return <div innerHTML={html} />;
                })()}
              </article>
            )}
          </Show>
        </Show>
      </SidePanel>
      {/* Left pane: search + list sorted by proximity (default) */}
      <div
        class="fixed z-10 bg-white/95 backdrop-blur border-r border-gray-200 shadow"
        style={{
          top: `${navHeight()}px`,
          left: "0",
          width: "320px",
          bottom: "0",
          display: "flex",
          "flex-direction": "column",
        }}
      >
        <div class="p-3 border-b border-gray-200">
          <div class="text-sm font-medium mb-2">Notes</div>
          <div class="flex items-center gap-2 mb-2">
            <input
              class="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              type="search"
              placeholder="Search titles…"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
            />
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-700">
            <label for="sortMode">Sort:</label>
            <select
              id="sortMode"
              class="rounded border border-gray-300 px-2 py-1 text-xs"
              value={sortMode()}
              onChange={(e) => setSortMode(e.currentTarget.value as any)}
            >
              <option value="proximity">Proximity (to mouse)</option>
              <option value="title">Title</option>
              <option value="date">Newest</option>
            </select>
            <div class="ml-auto text-[11px] text-gray-500">
              Zoom {scale().toFixed(2)}x · {docs()?.length || 0} notes
            </div>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto">
          <Show
            when={filteredAndSortedDocs().length > 0}
            fallback={<div class="p-3 text-sm text-gray-500">No notes</div>}
          >
            <ul>
              <For each={filteredAndSortedDocs().slice(0, 200)}>
                {(d) => {
                  const p = createMemo(() => positions().get(d.id));
                  const isHover = createMemo(
                    () => hoveredDocId() === d.id && showHoverLabel()
                  );
                  return (
                    <li>
                      <button
                        class={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 ${
                          isHover() ? "bg-amber-50" : ""
                        }`}
                        onClick={() => setSelectedId(d.id)}
                        title={d.title}
                      >
                        <span
                          style={{
                            "flex-shrink": 0,
                            width: "10px",
                            height: "10px",
                            background: colorFor(d.title),
                            display: "inline-block",
                            "border-radius": "9999px",
                            border: "1px solid rgba(0,0,0,0.2)",
                          }}
                        />
                        <span class="truncate text-sm">{d.title}</span>
                        <span class="ml-auto text-[10px] text-gray-500 flex-shrink-0">
                          {(() => {
                            const m = mouseWorld();
                            const pp = p();
                            if (!pp) return "";
                            const dx = pp.x - m.x;
                            const dy = pp.y - m.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            // Determine 8-way direction from mouse to item for subtle guidance
                            const angle = Math.atan2(-dy, dx);
                            const arrows = [
                              "→",
                              "↗",
                              "↑",
                              "↖",
                              "←",
                              "↙",
                              "↓",
                              "↘",
                            ];
                            const idx =
                              ((Math.round((angle * 8) / (2 * Math.PI)) % 8) +
                                8) %
                              8;
                            const arrow = arrows[idx];
                            return `${Math.round(dist)}u ${arrow}`;
                          })()}
                        </span>
                      </button>
                    </li>
                  );
                }}
              </For>
            </ul>
          </Show>
        </div>
        <div class="p-2 border-t border-gray-200 text-[11px] text-gray-600">
          Drag to pan, wheel to zoom · Left pane sorts by mouse proximity
        </div>
      </div>
    </main>
  );
};

const VisualRoute: VoidComponent = () => {
  return <VisualCanvas />;
};

export default VisualRoute;
