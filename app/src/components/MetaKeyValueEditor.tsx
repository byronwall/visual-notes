import {
  For,
  Show,
  Suspense,
  createEffect,
  createSignal,
  onCleanup,
} from "solid-js";
import type { VoidComponent } from "solid-js";
import { updateDocMeta, type MetaRecord } from "~/services/docs.service";
import { MetaKeySuggestions } from "./MetaKeySuggestions";
import { MetaValueSuggestions } from "./MetaValueSuggestions";
import { Popover } from "./Popover";

type Entry = { key: string; value: string };

export const MetaKeyValueEditor: VoidComponent<{
  docId?: string;
  initialMeta?: MetaRecord | null;
  onChange?: (meta: MetaRecord) => void;
}> = (props) => {
  const initialEntries: Entry[] = Object.entries(props.initialMeta || {}).map(
    ([k, v]) => ({ key: k, value: String(v) })
  );
  const [entries, setEntries] = createSignal<Entry[]>(initialEntries);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [isOpen, setIsOpen] = createSignal(false);
  const [editingIndex, setEditingIndex] = createSignal<number | null>(null);
  const [editKey, setEditKey] = createSignal("");
  const [editValue, setEditValue] = createSignal("");
  let anchorRef: HTMLDivElement | undefined;

  // suggestions now handled in child components

  const openForNew = () => {
    console.log("[MetaEditor] open add");
    setEditingIndex(null);
    setEditKey("");
    setEditValue("");
    setIsOpen(true);
  };

  const makeOpenForEdit = (i: number) => () => {
    const e = entries()[i];
    console.log("[MetaEditor] open edit", i, e);
    setEditingIndex(i);
    setEditKey(e?.key || "");
    setEditValue(e?.value || "");
    setIsOpen(true);
  };

  const closePopup = () => setIsOpen(false);

  const persistIfNeeded = async (next: Entry[]) => {
    if (props.docId) {
      setBusy(true);
      setError(undefined);
      try {
        const record: MetaRecord = {};
        for (const { key, value } of next) {
          const k = key.trim();
          if (!k) continue;
          record[k] = value;
        }
        console.log("[MetaEditor] persist", record);
        await updateDocMeta(props.docId, record);
      } catch (e) {
        setError((e as Error).message || "Failed to save metadata");
      } finally {
        setBusy(false);
      }
    } else if (props.onChange) {
      const record: MetaRecord = {};
      for (const { key, value } of next) {
        const k = key.trim();
        if (!k) continue;
        record[k] = value;
      }
      props.onChange(record);
    }
  };

  const handleSave = async () => {
    const idx = editingIndex();
    const next = entries().slice();
    const newEntry: Entry = { key: editKey(), value: editValue() };
    if (idx === null) {
      next.push(newEntry);
    } else {
      next[idx] = newEntry;
    }
    setEntries(next);
    await persistIfNeeded(next);
    setIsOpen(false);
  };

  const makeRemoveHandler = (i: number) => async (e: MouseEvent) => {
    e.stopPropagation();
    const next = entries().slice();
    next.splice(i, 1);
    setEntries(next);
    await persistIfNeeded(next);
  };

  const onKeydown = (ev: KeyboardEvent) => {
    if (!isOpen()) return;
    if (ev.key === "Escape") setIsOpen(false);
  };
  createEffect(() => {
    window.addEventListener("keydown", onKeydown);
    onCleanup(() => window.removeEventListener("keydown", onKeydown));
  });

  const handleFieldKeyDown = async (ev: KeyboardEvent) => {
    if (ev.key !== "Enter") return;
    const k = editKey().trim();
    const v = editValue().trim();
    if (!k || !v || busy()) return;
    console.log("[MetaEditor] enter-to-save", { k, v });
    await handleSave();
  };

  return (
    <div>
      <div class="flex flex-wrap gap-2" ref={(el) => (anchorRef = el)}>
        <For each={entries()}>
          {(e, i) => (
            <button
              class="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
              title={`${e.key}: ${e.value}`}
              onClick={makeOpenForEdit(i())}
            >
              <span class="font-medium text-gray-800 truncate max-w-[10rem]">
                {e.key}
              </span>
              <span class="text-gray-500">:</span>
              <span class="truncate max-w-[12rem] text-gray-700">
                {e.value}
              </span>
              <span
                class="ml-1 inline-flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 px-1"
                onClick={makeRemoveHandler(i())}
                aria-label="Remove"
              >
                ×
              </span>
            </button>
          )}
        </For>
        <button
          class="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
          onClick={openForNew}
          aria-label="Add metadata"
          title="Add metadata"
        >
          <span class="text-gray-600">+</span>
          <span class="text-gray-700">Add</span>
        </button>
      </div>

      <Show when={error()}>
        {(e) => <div class="text-xs text-red-700 mt-1">{e()}</div>}
      </Show>

      <Popover
        open={isOpen()}
        onClose={closePopup}
        anchorEl={anchorRef}
        placement="bottom-start"
        class="w-[90%] max-w-md p-4"
      >
        <div class="text-sm font-medium mb-2">Edit metadata</div>
        <div class="flex gap-2">
          <div>
            <input
              class="border rounded px-2 py-1 text-sm w-40"
              placeholder="key"
              value={editKey()}
              onInput={(evt) => setEditKey(evt.currentTarget.value)}
              onKeyDown={handleFieldKeyDown}
            />
            <Suspense fallback={null}>
              <MetaKeySuggestions onSelect={(k) => setEditKey(k)} />
            </Suspense>
          </div>
          <span class="text-gray-400">:</span>
          <div>
            <input
              class="border rounded px-2 py-1 text-sm flex-1"
              placeholder="value"
              value={editValue()}
              onInput={(evt) => setEditValue(evt.currentTarget.value)}
              onKeyDown={handleFieldKeyDown}
            />
            <Suspense fallback={null}>
              <MetaValueSuggestions
                keyName={editKey()}
                onSelect={(v) => setEditValue(v)}
              />
            </Suspense>
          </div>
        </div>

        <div class="mt-3 flex items-center gap-2 justify-end">
          <button
            class="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
            onClick={closePopup}
            type="button"
          >
            Cancel
          </button>
          <button
            class={`px-3 py-1.5 rounded border text-sm ${
              busy() ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-50"
            }`}
            onClick={handleSave}
            disabled={busy()}
          >
            {busy() ? "Saving…" : "Save"}
          </button>
        </div>
      </Popover>
    </div>
  );
};
