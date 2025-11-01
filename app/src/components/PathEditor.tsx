import {
  For,
  Show,
  Suspense,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";
import type { VoidComponent } from "solid-js";
import { fetchPathSuggestions, updateDocPath } from "~/services/docs.service";
import { Popover } from "./Popover";

export const PathEditor: VoidComponent<{
  docId?: string;
  initialPath?: string;
  onChange?: (path: string) => void;
}> = (props) => {
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [isOpen, setIsOpen] = createSignal(false);
  let anchorRef: HTMLDivElement | undefined;

  // Load all existing paths with counts once
  const [pathCounts] = createResource(fetchPathSuggestions);

  // Internal representation: committed segments + current editable segment
  const splitInitial = () => {
    const raw = (props.initialPath || "").trim();
    if (!raw) return { committed: [] as string[], current: "" };
    const tokens = raw.split(".").filter((t) => t.length > 0);
    if (tokens.length <= 1) return { committed: [], current: tokens[0] || "" };
    return {
      committed: tokens.slice(0, -1),
      current: tokens[tokens.length - 1] || "",
    };
  };

  const [committed, setCommitted] = createSignal<string[]>(
    splitInitial().committed
  );
  const [current, setCurrent] = createSignal<string>(splitInitial().current);

  const joinedPath = createMemo(() => {
    const parts = [...committed()];
    if (current().length > 0) parts.push(current());
    return parts.join(".");
  });

  // Sync internal state only when external initialPath changes
  // Important: do NOT depend on joinedPath() here, or typing will be reset
  createEffect(() => {
    const incoming = (props.initialPath || "").trim();
    if (!incoming) {
      setCommitted([]);
      setCurrent("");
      return;
    }
    const tokens = incoming.split(".").filter((t) => t.length > 0);
    if (tokens.length <= 1) {
      setCommitted([]);
      setCurrent(tokens[0] || "");
    } else {
      setCommitted(tokens.slice(0, -1));
      setCurrent(tokens[tokens.length - 1] || "");
    }
  });

  createEffect(() => {
    const value = joinedPath();
    console.log(`[PathEditor] path=${value}`);
    if (props.onChange) props.onChange(value);
  });

  // Build next-segment suggestions based on counts
  type PathCount = { path: string; count: number };
  const allPathCounts = createMemo<PathCount[]>(() => pathCounts() || []);

  const nextSegmentSuggestions = createMemo(() => {
    const data = allPathCounts();
    if (!Array.isArray(data) || data.length === 0)
      return [] as { seg: string; count: number }[];
    const prefixSegments = committed();
    const typed = current().trim();
    const counts = new Map<string, number>();

    if (prefixSegments.length === 0) {
      for (const item of data) {
        const t = item.path.split(".");
        const seg = t[0] || "";
        if (!seg) continue;
        if (typed && !seg.startsWith(typed)) continue;
        counts.set(seg, (counts.get(seg) || 0) + item.count);
      }
    } else {
      const base = prefixSegments.join(".") + ".";
      for (const item of data) {
        if (!item.path.startsWith(base)) continue;
        const t = item.path.split(".");
        const seg = t[prefixSegments.length] || "";
        if (!seg) continue;
        if (typed && !seg.startsWith(typed)) continue;
        counts.set(seg, (counts.get(seg) || 0) + item.count);
      }
    }
    const list = Array.from(counts.entries())
      .map(([seg, count]) => ({ seg, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
    return list;
  });

  const handleFocusInput = () => {
    setIsOpen(true);
  };

  const handleOutsideClose = () => {
    setIsOpen(false);
  };

  const commitCurrentSegment = () => {
    const value = current().trim();
    if (!value) return;
    setCommitted((prev) => [...prev, value]);
    setCurrent("");
  };

  const handleSelectSuggestion = (seg: string) => {
    console.log("[PathEditor] select seg", seg);
    setCurrent(seg);
    // Immediately commit chosen segment to move to the next level
    commitCurrentSegment();
    setIsOpen(true);
  };

  const handleBackspace = (ev: KeyboardEvent) => {
    if (ev.key !== "Backspace") return;
    if (current().length > 0) return;
    const prev = committed();
    if (prev.length === 0) return;
    const next = prev.slice(0, -1);
    const last = prev[prev.length - 1] || "";
    setCommitted(next);
    setCurrent(last);
  };

  const handleKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === ".") {
      ev.preventDefault();
      commitCurrentSegment();
      setIsOpen(true);
      return;
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      // finalize current segment
      commitCurrentSegment();
      setIsOpen(false);
      return;
    }
  };

  const handleSave = async () => {
    if (!props.docId) return;
    const finalPath = joinedPath().trim();
    setSaving(true);
    setError(undefined);
    try {
      await updateDocPath(props.docId, finalPath);
    } catch (e) {
      setError((e as Error).message || "Failed to save path");
    } finally {
      setSaving(false);
    }
  };

  const onWindowKeyDown = (ev: KeyboardEvent) => {
    if (!isOpen()) return;
    if (ev.key === "Escape") setIsOpen(false);
  };
  createEffect(() => {
    window.addEventListener("keydown", onWindowKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onWindowKeyDown));
  });

  const truncateTo = (index: number) => () => {
    const parts = committed();
    if (index < 0 || index >= parts.length) return;
    const next = parts.slice(0, index + 1);
    setCommitted(next);
    setCurrent("");
    setIsOpen(true);
  };

  const clearAll = async () => {
    if (props.docId) {
      // only confirm if we have a docId -- cannot save otherwise
      // TODO: this logic should really be in one place.
      const confirmed = window.confirm(
        "Clear the path and save it as empty? This will reset the path to the base level."
      );
      if (!confirmed) return;
    }
    console.log("[PathEditor] clear -> saving empty path");
    setCommitted([]);
    setCurrent("");
    setIsOpen(false);
    await handleSave();
  };

  return (
    <div class="flex items-center gap-2">
      <div class="flex-1 min-w-0" ref={(el) => (anchorRef = el)}>
        <div
          class="w-full border rounded px-2 py-1 text-sm flex flex-wrap items-center gap-1 min-h-[32px] cursor-text"
          onClick={() => {
            const input = document.getElementById(
              "path-editor-input"
            ) as HTMLInputElement | null;
            if (input) {
              input.focus();
              setIsOpen(true);
            }
          }}
        >
          <Show when={committed().length === 0 && current().length === 0}>
            <span class="text-gray-400">e.g. work.projects.alpha</span>
          </Show>
          <For each={committed()}>
            {(seg, i) => (
              <>
                <span
                  class="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs"
                  title={seg}
                  onClick={truncateTo(i())}
                >
                  <span class="font-medium text-gray-800 truncate max-w-[10rem]">
                    {seg}
                  </span>
                </span>
                <span class="text-gray-400">.</span>
              </>
            )}
          </For>

          <input
            id="path-editor-input"
            class="flex-1 min-w-[8ch] outline-none text-sm"
            value={current()}
            onInput={(e) =>
              setCurrent((e.currentTarget as HTMLInputElement).value)
            }
            onFocus={handleFocusInput}
            onKeyDown={(e) => {
              handleKeyDown(e as unknown as KeyboardEvent);
              handleBackspace(e as unknown as KeyboardEvent);
            }}
          />
        </div>

        <Show when={error()}>
          {(e) => <div class="text-xs text-red-700 mt-1">{e()}</div>}
        </Show>

        <Suspense fallback={null}>
          <Popover
            open={isOpen()}
            onClose={handleOutsideClose}
            anchorEl={anchorRef}
            placement="bottom-start"
            class="w-[90%] max-w-md p-3"
          >
            <div class="text-xs text-gray-600 mb-2">
              <Show
                when={committed().length === 0}
                fallback={
                  <span>
                    Next after{" "}
                    <span class="font-medium">{committed().join(".")}</span>
                  </span>
                }
              >
                <span>Popular top-level segments</span>
              </Show>
            </div>
            <div class="text-xs text-gray-500 mb-2">
              Hit <span class="font-mono">.</span> to nest
            </div>
            <div class="flex flex-wrap gap-2">
              <For each={nextSegmentSuggestions()}>
                {(s) => (
                  <button
                    class="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
                    onClick={() => handleSelectSuggestion(s.seg)}
                    title={`${s.seg} (${s.count})`}
                  >
                    <span class="font-medium text-gray-800 truncate max-w-[12rem]">
                      {s.seg}
                    </span>
                    <span class="text-gray-500">{s.count}</span>
                  </button>
                )}
              </For>
            </div>
            <Show when={nextSegmentSuggestions().length === 0}>
              <div class="text-xs text-gray-500">No suggestions</div>
            </Show>
          </Popover>
        </Suspense>
      </div>

      <Show when={props.docId}>
        <button
          class={`px-2 py-1 rounded border text-xs ${
            saving() ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-50"
          }`}
          onClick={handleSave}
          disabled={saving()}
        >
          {saving() ? "Saving…" : "Save"}
        </button>
      </Show>
      <button
        class="px-2 py-1 rounded border text-xs hover:bg-gray-50"
        onClick={clearAll}
        type="button"
      >
        Clear
      </button>
    </div>
  );
};
