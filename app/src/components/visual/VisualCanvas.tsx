import {
  For,
  Show,
  createEffect,
  createMemo,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { colorFor } from "~/utils/colors";
import { seededPositionFor } from "~/layout/seeded";
import type { DocItem } from "~/types/notes";

type Point = { x: number; y: number };

type PanZoomHandlers = {
  onWheel: (e: WheelEvent) => void;
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
};

export type VisualCanvasProps = {
  docs: DocItem[] | undefined;
  positions: Accessor<Map<string, Point>>;
  umapIndex: Accessor<Map<string, { x: number; y: number }>>;
  hoveredId: Accessor<string | undefined>;
  hoveredLabelScreen: Accessor<
    { x: number; y: number; title: string } | undefined
  >;
  showHoverLabel: Accessor<boolean>;
  viewTransform: Accessor<string>;
  navHeight: Accessor<number>;
  searchQuery: Accessor<string>;
  hideNonMatches: Accessor<boolean>;
  layoutMode: Accessor<"umap" | "grid">;
  nestByPath: Accessor<boolean>;
  eventHandlers: PanZoomHandlers;
  onSelectDoc: (id: string) => void;
  // TODO:TYPE_MIRROR, allow extra props to avoid JSX excess property errors during incremental edits
  [key: string]: unknown;
};

const SPREAD = 1000;

export const VisualCanvas: VoidComponent<VisualCanvasProps> = (props) => {
  return (
    <div
      class="fixed overflow-hidden bg-white"
      style={{
        position: "fixed",
        left: "0",
        right: "0",
        bottom: "0",
        top: `${props.navHeight()}px`,
      }}
      onWheel={props.eventHandlers.onWheel}
      onPointerDown={props.eventHandlers.onPointerDown}
      onPointerMove={props.eventHandlers.onPointerMove}
      onPointerUp={props.eventHandlers.onPointerUp}
    >
      <svg
        width="100%"
        height="100%"
        style={{ display: "block", background: "white" }}
      >
        <g transform={props.viewTransform()}>
          <Show when={props.docs}>
            {(docs) => {
              const listOrdered = createMemo(() => {
                const list = docs();
                if (!list) return [] as DocItem[];
                if (!props.nestByPath() || props.layoutMode() !== "grid") return list;
                const byTop = new Map<string, DocItem[]>();
                for (const d of list) {
                  const top = (d.path || "").split(".").filter(Boolean)[0] || "∅";
                  const arr = byTop.get(top) || [];
                  arr.push(d);
                  byTop.set(top, arr);
                }
                const groups = Array.from(byTop.keys()).sort((a, b) => a.localeCompare(b));
                const index = props.umapIndex();
                const out: DocItem[] = [];
                for (const g of groups) {
                  const arr = byTop.get(g)!;
                  arr.sort((a, b) => {
                    const pa = index.get(a.id);
                    const pb = index.get(b.id);
                    const xa = pa ? pa.x : 0;
                    const xb = pb ? pb.x : 0;
                    return xa - xb;
                  });
                  out.push(...arr);
                }
                try {
                  console.log(`[visual-canvas] nestByPath ordering applied: groups=${groups.length}`);
                } catch {}
                return out;
              });

              const pathBoxes = createMemo(() => {
                if (!props.nestByPath() || props.layoutMode() !== "grid")
                  return [] as { key: string; depth: number; minX: number; minY: number; maxX: number; maxY: number }[];
                const list = docs() || [];
                const pos = props.positions();
                const tree = new Map<string, { ids: string[]; depth: number }>();
                for (const d of list) {
                  const segments = (d.path || "").split(".").filter(Boolean);
                  let prefix = "";
                  for (let i = 0; i < segments.length; i++) {
                    prefix = prefix ? `${prefix}.${segments[i]}` : segments[i]!;
                    const node = tree.get(prefix) || { ids: [], depth: i + 1 };
                    node.ids.push(d.id);
                    tree.set(prefix, node);
                  }
                }
                const boxes: { key: string; depth: number; minX: number; minY: number; maxX: number; maxY: number }[] = [];
                for (const [key, node] of tree) {
                  let minX = Number.POSITIVE_INFINITY;
                  let minY = Number.POSITIVE_INFINITY;
                  let maxX = Number.NEGATIVE_INFINITY;
                  let maxY = Number.NEGATIVE_INFINITY;
                  for (const id of node.ids) {
                    const p = pos.get(id);
                    if (!p) continue;
                    if (p.x < minX) minX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y > maxY) maxY = p.y;
                  }
                  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) continue;
                  const pad = 18;
                  boxes.push({ key, depth: node.depth, minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad });
                }
                boxes.sort((a, b) => a.depth - b.depth);
                return boxes;
              });

              return (
                <>
                  <For each={pathBoxes()}>
                    {(b) => {
                      const isGrid = props.layoutMode() === "grid";
                      const boxFill = isGrid ? "#e5e7eb" : "#f8fafc"; // darker bg in Z-order view
                      const boxStroke = isGrid ? "#475569" : "#cbd5e1"; // thicker, darker border in Z-order view
                      const boxStrokeW = isGrid ? 3 : 1;
                      return (
                        <g>
                          <rect
                            x={b.minX}
                            y={b.minY}
                            width={b.maxX - b.minX}
                            height={b.maxY - b.minY}
                            rx={8}
                            ry={8}
                            fill={boxFill}
                            stroke={boxStroke}
                            stroke-width={boxStrokeW}
                          />
                        </g>
                      );
                    }}
                  </For>
                  <For each={listOrdered()}>
                    {(d, i) => {
                  const pos = createMemo(
                    () =>
                      props.positions().get(d.id) ??
                      seededPositionFor(d.title, i(), SPREAD)
                  );
                      const fill = createMemo(() =>
                        props.layoutMode() === "umap"
                          ? colorFor(d.path || d.title)
                          : colorFor(d.title)
                      );
                  const isHovered = createMemo(
                    () => props.hoveredId() === d.id && props.showHoverLabel()
                  );
                  const matchesSearch = createMemo(() => {
                    const q = props.searchQuery().trim().toLowerCase();
                    if (!q) return true;
                    return d.title.toLowerCase().includes(q);
                  });
                  const dimmed = createMemo(
                    () => !!props.searchQuery().trim() && !matchesSearch()
                  );
                  return (
                    <Show when={!props.hideNonMatches() || matchesSearch()}>
                      <g>
                        <circle
                          cx={pos().x}
                          cy={pos().y}
                          r={10}
                              fill={dimmed() ? "#9CA3AF" : fill()}
                          stroke={
                            isHovered()
                              ? "#111"
                              : dimmed()
                              ? "#00000010"
                              : "#00000020"
                          }
                          stroke-width={isHovered() ? 2 : 1}
                          style={{ cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            props.onSelectDoc(d.id);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                        />
                      </g>
                    </Show>
                  );
                    }}
                  </For>
                </>
              );
            }}
          </Show>
        </g>
      </svg>
      {(() => {
        const hoveredIsMatch = createMemo(() => {
          const id = props.hoveredId();
          if (!id) return false;
          const q = props.searchQuery().trim().toLowerCase();
          if (!q) return true;
          const d = (props.docs || []).find((x) => x.id === id);
          return d ? d.title.toLowerCase().includes(q) : false;
        });
        const showHover = createMemo(() => {
          const hasLbl = !!props.hoveredLabelScreen();
          if (!hasLbl) return false;
          if (props.hideNonMatches() && !hoveredIsMatch()) return false;
          return true;
        });
        const lbl = createMemo(() => props.hoveredLabelScreen());
        return (
          <Show when={showHover()}>
            {(() => {
              const l = lbl()!;
              return (
                <div
                  class="absolute"
                  style={{
                    left: `${l.x + 12}px`,
                    top: `${l.y - 10}px`,
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
                    {l.title}
                  </div>
                </div>
              );
            })()}
          </Show>
        );
      })()}
    </div>
  );
};

export default VisualCanvas;
