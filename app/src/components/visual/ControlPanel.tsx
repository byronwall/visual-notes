import {
  For,
  Show,
  createMemo,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { colorFor } from "~/utils/colors";

type Point = { x: number; y: number };

type DocItem = {
  id: string;
  title: string;
  createdAt: string;
};

export type ControlPanelProps = {
  docs: Accessor<DocItem[] | undefined>;
  positions: Accessor<Map<string, Point>>;
  mouseWorld: Accessor<{ x: number; y: number }>;
  hoveredId: Accessor<string | undefined>;
  showHoverLabel: Accessor<boolean>;
  navHeight: Accessor<number>;
  scale: Accessor<number>;
  searchQuery: Accessor<string>;
  setSearchQuery: (v: string) => void;
  sortMode: Accessor<"proximity" | "title" | "date">;
  setSortMode: (m: "proximity" | "title" | "date") => void;
  nudging: Accessor<boolean>;
  onNudge: (iterations?: number) => void;
  onSelectDoc: (id: string) => void;
  layoutMode: Accessor<"umap" | "grid">;
  setLayoutMode: (m: "umap" | "grid") => void;
};

export const ControlPanel: VoidComponent<ControlPanelProps> = (props) => {
  const filteredAndSortedDocs = createMemo(() => {
    const list = props.docs() || [];
    const q = props.searchQuery().trim().toLowerCase();
    const pos = props.positions();
    const m = props.mouseWorld();
    const sMode = props.sortMode();
    const filtered = q
      ? list.filter((d) => d.title.toLowerCase().includes(q))
      : list.slice();
    if (sMode === "title") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sMode === "date") {
      filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    } else {
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
    <div
      class="fixed z-10 bg-white/95 backdrop-blur border-r border-gray-200 shadow"
      style={{
        top: `${props.navHeight()}px`,
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
            value={props.searchQuery()}
            onInput={(e) => props.setSearchQuery(e.currentTarget.value)}
          />
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs text-gray-700">
          <label for="sortMode">Sort:</label>
          <select
            id="sortMode"
            class="rounded border border-gray-300 px-2 py-1 text-xs"
            value={props.sortMode()}
            onChange={(e) => props.setSortMode(e.currentTarget.value as any)}
          >
            <option value="proximity">Proximity (to mouse)</option>
            <option value="title">Title</option>
            <option value="date">Newest</option>
          </select>
          <label for="layoutMode" class="ml-2">
            Layout:
          </label>
          {(() => {
            const handleLayoutChange = (
              e: Event & { currentTarget: HTMLSelectElement }
            ) => {
              const value = e.currentTarget.value as "umap" | "grid";
              props.setLayoutMode(value);
            };
            return (
              <select
                id="layoutMode"
                class="rounded border border-gray-300 px-2 py-1 text-xs"
                value={props.layoutMode()}
                onChange={handleLayoutChange}
              >
                <option value="umap">UMAP (raw)</option>
                <option value="grid">Grid (Z-order)</option>
              </select>
            );
          })()}
          <button
            class={`ml-2 rounded px-2 py-1 border text-xs ${
              props.nudging()
                ? "opacity-60 cursor-not-allowed"
                : "hover:bg-gray-50"
            }`}
            disabled={props.nudging()}
            onClick={() => props.onNudge(200)}
            title="Repel overlapping nodes a bit"
          >
            {props.nudging() ? "Nudging…" : "Nudge"}
          </button>
          <div class="ml-auto flex items-center gap-2 text-[11px] text-gray-500 basis-full sm:basis-auto justify-end">
            <span class="whitespace-nowrap">
              Zoom {props.scale().toFixed(2)}x
            </span>
            <span class="text-gray-300">·</span>
            <span class="whitespace-nowrap">
              {props.docs()?.length || 0} notes
            </span>
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
                const p = createMemo(() => props.positions().get(d.id));
                const isHover = createMemo(
                  () => props.hoveredId() === d.id && props.showHoverLabel()
                );
                return (
                  <li>
                    <button
                      class={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 ${
                        isHover() ? "bg-amber-50" : ""
                      }`}
                      onClick={() => props.onSelectDoc(d.id)}
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
                          const m = props.mouseWorld();
                          const pp = p();
                          if (!pp) return "";
                          const dx = pp.x - m.x;
                          const dy = pp.y - m.y;
                          const dist = Math.sqrt(dx * dx + dy * dy);
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
  );
};

export default ControlPanel;
