import {
  For,
  Show,
  createMemo,
  createSignal,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { colorFor } from "~/utils/colors";
import type { DocItem } from "~/types/notes";
import type { createSelectionStore } from "~/stores/selection.store";
import Modal from "~/components/Modal";
import { MetaKeyValueEditor } from "~/components/MetaKeyValueEditor";
import { PathEditor } from "~/components/PathEditor";
import { MetaKeySuggestions } from "~/components/MetaKeySuggestions";
import { MetaValueSuggestions } from "~/components/MetaValueSuggestions";
import {
  updateDocMeta,
  updateDocPath,
  type MetaRecord,
} from "~/services/docs.service";

type Point = { x: number; y: number };

export type ControlPanelProps = {
  docs: DocItem[] | undefined;
  positions: Accessor<Map<string, Point>>;
  mouseWorld: Accessor<{ x: number; y: number }>;
  hoveredId: Accessor<string | undefined>;
  showHoverLabel: Accessor<boolean>;
  navHeight: Accessor<number>;
  scale: Accessor<number>;
  searchQuery: Accessor<string>;
  setSearchQuery: (v: string) => void;
  hideNonMatches: Accessor<boolean>;
  setHideNonMatches: (v: boolean) => void;
  sortMode: Accessor<"proximity" | "title" | "date">;
  setSortMode: (m: "proximity" | "title" | "date") => void;
  nudging: Accessor<boolean>;
  onNudge: (iterations?: number) => void;
  onSelectDoc: (id: string) => void;
  layoutMode: Accessor<"umap" | "grid">;
  setLayoutMode: (m: "umap" | "grid") => void;
  nestByPath: Accessor<boolean>;
  setNestByPath: (v: boolean) => void;
  selection?: ReturnType<typeof createSelectionStore>;
  // Filters
  pathPrefix: Accessor<string>;
  setPathPrefix: (v: string) => void;
  blankPathOnly: Accessor<boolean>;
  setBlankPathOnly: (v: boolean) => void;
  metaKey: Accessor<string>;
  setMetaKey: (v: string) => void;
  metaValue: Accessor<string>;
  setMetaValue: (v: string) => void;
  // TODO:TYPE_MIRROR, allow extra props for forward-compat without tightening here
  [key: string]: unknown;
};

export const ControlPanel: VoidComponent<ControlPanelProps> = (props) => {
  const filteredAndSortedDocs = createMemo(() => {
    const list = props.docs || [];
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

  // Selection action state
  const selectedCount = createMemo(
    () => props.selection?.selectedIds().size || 0
  );
  const [showMetaModal, setShowMetaModal] = createSignal(false);
  const [showPathModal, setShowPathModal] = createSignal(false);
  const [bulkBusy, setBulkBusy] = createSignal(false);
  const [bulkError, setBulkError] = createSignal<string | undefined>(undefined);
  const [bulkPathDraft, setBulkPathDraft] = createSignal("");

  const handleIsolate = () => props.selection?.isolateSelection();
  const handleClearSelection = () => props.selection?.clearSelection();
  const handleOpenMeta = () => setShowMetaModal(true);
  const handleOpenPath = () => setShowPathModal(true);
  const handleCloseMeta = () => setShowMetaModal(false);
  const handleClosePath = () => setShowPathModal(false);
  const handlePopIso = () => props.selection?.popIsolation();
  const handleClearIso = () => props.selection?.clearIsolation();

  const handleApplyMeta = async (record: MetaRecord) => {
    const sel = props.selection;
    if (!sel) return;
    const ids = Array.from(sel.selectedIds());
    if (ids.length === 0) return;
    setBulkBusy(true);
    setBulkError(undefined);
    try {
      console.log("[panel] bulk meta apply", { count: ids.length, record });
      await Promise.all(ids.map((id) => updateDocMeta(id, record)));
    } catch (e) {
      setBulkError((e as Error).message || "Failed to apply metadata");
    } finally {
      setBulkBusy(false);
      setShowMetaModal(false);
    }
  };

  const handleApplyPath = async (path: string) => {
    const sel = props.selection;
    if (!sel) return;
    const ids = Array.from(sel.selectedIds());
    if (ids.length === 0) return;
    setBulkBusy(true);
    setBulkError(undefined);
    try {
      console.log("[panel] bulk path apply", { count: ids.length, path });
      await Promise.all(ids.map((id) => updateDocPath(id, path)));
    } catch (e) {
      setBulkError((e as Error).message || "Failed to update paths");
    } finally {
      setBulkBusy(false);
      setShowPathModal(false);
    }
  };

  return (
    <div
      class="fixed z-10 bg-white/95 backdrop-blur border-r border-gray-200 shadow overflow-x-hidden"
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
        {/* Path and Meta Filters */}
        {(() => {
          const handlePathChange = (p: string) => props.setPathPrefix(p);
          const handleBlankToggle = (
            ev: Event & { currentTarget: HTMLInputElement }
          ) => {
            const checked = ev.currentTarget.checked;
            props.setBlankPathOnly(checked);
            if (checked) props.setPathPrefix("");
          };
          const handleMetaKeyInput = (
            ev: Event & { currentTarget: HTMLInputElement }
          ) => {
            props.setMetaKey(ev.currentTarget.value);
          };
          const handleMetaValueInput = (
            ev: Event & { currentTarget: HTMLInputElement }
          ) => {
            props.setMetaValue(ev.currentTarget.value);
          };
          const clearMetaFilter = () => {
            props.setMetaKey("");
            props.setMetaValue("");
          };
          return (
            <div class="space-y-3 mb-3">
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-xs text-gray-600">Path</span>
                </div>
                <div
                  class={`${
                    props.blankPathOnly()
                      ? "opacity-50 pointer-events-none"
                      : ""
                  }`}
                >
                  <PathEditor
                    initialPath={props.pathPrefix()}
                    onChange={handlePathChange}
                  />
                </div>
                <label class="mt-2 flex items-center gap-1 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={props.blankPathOnly()}
                    onChange={handleBlankToggle}
                  />
                  <span>Blank only</span>
                </label>
              </div>

              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs text-gray-600">Meta</span>
                  <button
                    class="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                    onClick={clearMetaFilter}
                    title="Clear meta filter"
                    type="button"
                  >
                    Clear
                  </button>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    class="min-w-0 rounded border border-gray-300 px-2 py-1 text-xs"
                    placeholder="key"
                    value={props.metaKey()}
                    onInput={handleMetaKeyInput}
                  />
                  <input
                    class="min-w-0 rounded border border-gray-300 px-2 py-1 text-xs"
                    placeholder="value"
                    value={props.metaValue()}
                    onInput={handleMetaValueInput}
                  />
                </div>
                <div class="mt-2">
                  <MetaKeySuggestions
                    onSelect={(k) => props.setMetaKey(k)}
                    limit={8}
                  />
                  <MetaValueSuggestions
                    keyName={props.metaKey()}
                    onSelect={(v) => props.setMetaValue(v)}
                    limit={8}
                  />
                </div>
              </div>
            </div>
          );
        })()}
        <Show when={(props.selection?.breadcrumbs().length || 0) > 0}>
          {(() => {
            const crumbs = props.selection!.breadcrumbs();
            return (
              <div class="flex flex-wrap items-center gap-1 mb-2 text-xs">
                {crumbs.map((c, i) => (
                  <button
                    class="px-2 py-1 rounded border hover:bg-gray-50"
                    onClick={() => props.selection!.popIsolationTo(i)}
                  >
                    {c.label || `Level ${i + 1}`} ({c.ids.length})
                  </button>
                ))}
                <button
                  class="ml-auto px-2 py-1 rounded border hover:bg-gray-50"
                  onClick={handlePopIso}
                >
                  Back
                </button>
                <button
                  class="px-2 py-1 rounded border hover:bg-gray-50"
                  onClick={handleClearIso}
                >
                  Clear
                </button>
              </div>
            );
          })()}
        </Show>
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
          <label class="ml-2 inline-flex items-center gap-1 select-none">
            <input
              type="checkbox"
              checked={props.nestByPath()}
              onChange={(e) => props.setNestByPath(e.currentTarget.checked)}
            />
            <span>Nest by path</span>
          </label>
          <label class="ml-2 inline-flex items-center gap-1 select-none">
            <input
              type="checkbox"
              checked={props.hideNonMatches()}
              onChange={(e) => props.setHideNonMatches(e.currentTarget.checked)}
            />
            <span>Hide non-matches</span>
          </label>
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
              {props.docs?.length || 0} notes
            </span>
            <Show when={selectedCount() > 0}>
              {(() => (
                <>
                  <span class="text-gray-300">·</span>
                  <span class="whitespace-nowrap">
                    {selectedCount()} selected
                  </span>
                </>
              ))()}
            </Show>
          </div>
        </div>
        <Show when={selectedCount() > 0}>
          {(() => (
            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <button
                class="rounded px-2 py-1 border hover:bg-gray-50"
                onClick={handleIsolate}
                title="Render only the selected items"
              >
                Isolate
              </button>
              <button
                class="rounded px-2 py-1 border hover:bg-gray-50"
                onClick={handleOpenMeta}
              >
                Tag (meta)
              </button>
              <button
                class="rounded px-2 py-1 border hover:bg-gray-50"
                onClick={handleOpenPath}
              >
                Bulk Path
              </button>
              <button
                class="rounded px-2 py-1 border hover:bg-gray-50"
                onClick={handleClearSelection}
              >
                Clear Sel
              </button>
            </div>
          ))()}
        </Show>
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
                          background:
                            props.layoutMode() === "umap"
                              ? colorFor(d.path || d.title)
                              : colorFor(d.title),
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

      <Modal open={showMetaModal()} onClose={handleCloseMeta}>
        <div class="p-3">
          <div class="text-sm font-medium mb-2">
            Apply metadata to selection
          </div>
          <Show when={!!bulkError()}>
            <div class="text-red-600 text-xs mb-2">{bulkError()}</div>
          </Show>
          <MetaKeyValueEditor
            onChange={(rec) => {
              if (bulkBusy()) return;
              void handleApplyMeta(rec);
            }}
          />
        </div>
      </Modal>

      <Modal open={showPathModal()} onClose={handleClosePath}>
        <div class="p-3">
          <div class="text-sm font-medium mb-2">Set path for selection</div>
          <Show when={!!bulkError()}>
            <div class="text-red-600 text-xs mb-2">{bulkError()}</div>
          </Show>
          <div class="mb-3">
            <PathEditor onChange={(path) => setBulkPathDraft(path)} />
          </div>
          <div class="flex justify-end gap-2">
            <button
              class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50"
              onClick={handleClosePath}
            >
              Cancel
            </button>
            <button
              class={`rounded px-3 py-1.5 border text-xs ${
                bulkBusy()
                  ? "opacity-60 cursor-not-allowed"
                  : "hover:bg-gray-50"
              }`}
              disabled={bulkBusy()}
              onClick={() => {
                const v = bulkPathDraft().trim();
                if (!v) return;
                void handleApplyPath(v);
              }}
            >
              Apply to {selectedCount()} items
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ControlPanel;
