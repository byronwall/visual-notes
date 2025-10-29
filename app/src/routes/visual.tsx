import {
  type VoidComponent,
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import DocumentSidePanel from "../components/DocumentSidePanel";
import {
  useDocsResource,
  useUmapPointsResource,
  useUmapRunResource,
} from "~/services/docs.resources";
import { colorFor } from "~/utils/colors";
import { seededPositionFor } from "~/layout/seeded";
import { kdNearest } from "~/spatial/kdtree";
import { createCanvasStore } from "~/stores/canvas.store";
import { createPositionsStore } from "~/stores/positions.store";
// DocumentSidePanel will load the full document on demand

const SPREAD = 1000;
const isBrowser = typeof window !== "undefined";

// data & layout helpers moved to services/utils/layout modules

// seededPositionFor, colorFor now imported

const VisualCanvas: VoidComponent = () => {
  const [docs, { refetch: refetchDocs }] = useDocsResource();
  const [umapRun, { refetch: refetchUmapRun }] = useUmapRunResource();
  // Refetch points whenever the latest run id changes to avoid stale data after client navigation
  const [umapPoints, { refetch: refetchUmapPoints }] = useUmapPointsResource(
    () => umapRun()?.id
  );
  const [selectedId, setSelectedId] = createSignal<string | undefined>(
    undefined
  );
  // Panel fetches document internally

  // Stores
  const canvasStore = createCanvasStore();
  const positionsStore = createPositionsStore({
    docs,
    umapRun,
    umapPoints,
    useUmap: canvasStore.useUmap,
  });

  // SVG elements + pan anchor
  let svgEl: SVGSVGElement | undefined;
  let gEl: SVGGElement | undefined;
  let lastPan = { x: 0, y: 0 };

  // Mouse tracking (screen and world space)
  const mouseWorld = createMemo(() => {
    const s = canvasStore.scale();
    const t = canvasStore.offset();
    const m = canvasStore.mouseScreen();
    return { x: (m.x - t.x) / s, y: (m.y - t.y) / s };
  });

  // Click detection thresholds (element-relative screen space)
  const CLICK_TOL_PX = 5; // movement within this is considered a click, not a pan
  const CLICK_TOL_MS = 500; // optional time window for a click
  let clickStart: { x: number; y: number } | undefined;
  let clickStartTime = 0;

  // Positions and transform via stores
  const positions = () => positionsStore.positions();
  const viewTransform = () => canvasStore.viewTransform();
  const scheduleTransform = () => canvasStore.scheduleTransform();

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY;
    const zoomIntensity = 0.0015; // smaller = slower zoom
    // Use element-relative mouse coordinates to avoid offset bugs
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const currentScale = canvasStore.scale();
    const newScale = Math.min(
      4,
      Math.max(0.2, currentScale * Math.pow(2, -delta * zoomIntensity))
    );

    const t = canvasStore.offset();
    // Zoom towards the mouse position (screen-space to world-space adjustment)
    const worldXBefore = mouseX - t.x;
    const worldYBefore = mouseY - t.y;
    const worldXAfter = worldXBefore * (newScale / currentScale);
    const worldYAfter = worldYBefore * (newScale / currentScale);
    const dx = worldXBefore - worldXAfter;
    const dy = worldYBefore - worldYAfter;

    canvasStore.setScale(newScale);
    canvasStore.setOffset({ x: t.x + dx, y: t.y + dy });
    scheduleTransform();
  }

  function onPointerDown(e: PointerEvent) {
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    container.setPointerCapture(e.pointerId);
    canvasStore.setIsPanning(true);
    // Initialize pan anchor in element-relative coordinates for consistency
    lastPan = { x: localX, y: localY };
    // Ensure mouse position is current even if user doesn't move before release
    canvasStore.setMouseScreen({ x: localX, y: localY });
    // Track click candidate
    clickStart = { x: localX, y: localY };
    clickStartTime =
      typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  function onPointerMove(e: PointerEvent) {
    // Track element-relative mouse coordinates
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    canvasStore.setMouseScreen({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    if (!canvasStore.isPanning()) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const dx = localX - lastPan.x;
    const dy = localY - lastPan.y;
    lastPan = { x: localX, y: localY };
    const t = canvasStore.offset();
    canvasStore.setOffset({ x: t.x + dx, y: t.y + dy });
    scheduleTransform();
  }

  function onPointerUp(e: PointerEvent) {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    canvasStore.setIsPanning(false);
    // Detect bare click (minimal movement, short duration) to open nearest item
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    canvasStore.setMouseScreen({ x: localX, y: localY });
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
    canvasStore.setNavHeight(h);
  }

  function fitToSpread() {
    canvasStore.fitToSpread(SPREAD);
  }

  onMount(() => {
    measureNav();
    // Center the origin initially under navbar
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    canvasStore.setOffset({
      x: vw / 2,
      y: canvasStore.navHeight() + (vh - canvasStore.navHeight()) / 2,
    });
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
          pos: seededPositionFor(d.title, i, SPREAD),
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
    const index = positionsStore.umapIndex();
    let usedUmap = 0;
    let usedSeed = 0;
    for (const d of list) {
      if (canvasStore.useUmap() && index.has(d.id)) usedUmap++;
      else usedSeed++;
    }
    const sample = list.slice(0, Math.min(10, list.length)).map((d, i) => {
      const fromUmap = canvasStore.useUmap() ? index.get(d.id) : undefined;
      return {
        id: d.id,
        title: d.title,
        source: fromUmap ? "umap" : "seed",
        pos: fromUmap ?? seededPositionFor(d.title, i, SPREAD),
      };
    });
    console.log(
      `[visual] coordinate sources → umap=${usedUmap}, seeded=${usedSeed} (sample below)`
    );
    console.log(sample);
  });

  onCleanup(() => {
    if (isBrowser) {
      window.removeEventListener("resize", scheduleTransform);
    }
  });

  // ---------- Spatial index (KD-Tree) for nearest lookup ----------

  const kdTree = createMemo(() => positionsStore.kdTree());

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
    const s = canvasStore.scale();
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
    const s = canvasStore.scale();
    const t = canvasStore.offset();
    const title = (docs() || []).find((d) => d.id === id)?.title || id;
    return { x: pos.x * s + t.x, y: pos.y * s + t.y, title };
  });

  // Nudge handled by positions store (placeholder in Step 4)

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
          top: `${canvasStore.navHeight()}px`,
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
                        positions().get(d.id) ??
                        seededPositionFor(d.title, i(), SPREAD)
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
      <DocumentSidePanel
        open={!!selectedId()}
        docId={selectedId()}
        onClose={(shouldRefetch) => {
          if (shouldRefetch) {
            refetchDocs();
          }
          setSelectedId(undefined);
        }}
      />
      {/* Left pane: search + list sorted by proximity (default) */}
      <div
        class="fixed z-10 bg-white/95 backdrop-blur border-r border-gray-200 shadow"
        style={{
          top: `${canvasStore.navHeight()}px`,
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
            <button
              class={`ml-2 rounded px-2 py-1 border text-xs ${
                positionsStore.nudging()
                  ? "opacity-60 cursor-not-allowed"
                  : "hover:bg-gray-50"
              }`}
              disabled={positionsStore.nudging()}
              onClick={() => positionsStore.runNudge(200)}
              title="Repel overlapping nodes a bit"
            >
              {positionsStore.nudging() ? "Nudging…" : "Nudge"}
            </button>
            <div class="ml-auto text-[11px] text-gray-500">
              Zoom {canvasStore.scale().toFixed(2)}x · {docs()?.length || 0}{" "}
              notes
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
