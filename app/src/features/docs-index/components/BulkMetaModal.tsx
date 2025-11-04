import { For, Show, createMemo, createSignal, type VoidComponent } from "solid-js";
import Modal from "~/components/Modal";

export type BulkMetaAction =
  | { type: "add"; key: string; value: string | number | boolean | null }
  | { type: "update"; key: string; value: string | number | boolean | null }
  | { type: "remove"; key: string };

export const BulkMetaModal: VoidComponent<{
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  onApply: (actions: BulkMetaAction[]) => Promise<void>;
}> = (props) => {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [actions, setActions] = createSignal<BulkMetaAction[]>([]);

  const [draftType, setDraftType] = createSignal<"add" | "update" | "remove">("add");
  const [draftKey, setDraftKey] = createSignal("");
  const [draftValueType, setDraftValueType] = createSignal<"string" | "number" | "boolean" | "null">("string");
  const [draftValueRaw, setDraftValueRaw] = createSignal("");

  const canAdd = createMemo(() => {
    const t = draftType();
    const k = draftKey().trim();
    if (!k) return false;
    if (t === "remove") return true;
    // add/update require a value
    if (draftValueType() === "null") return true;
    return draftValueRaw().trim().length > 0;
  });

  const parseDraftValue = (): string | number | boolean | null => {
    const vt = draftValueType();
    if (vt === "null") return null;
    if (vt === "boolean") return /^true$/i.test(draftValueRaw().trim());
    if (vt === "number") {
      const n = Number(draftValueRaw());
      return Number.isFinite(n) ? n : 0;
    }
    return draftValueRaw();
  };

  const handleAddAction = () => {
    if (!canAdd()) return;
    const k = draftKey().trim();
    const t = draftType();
    if (t === "remove") {
      setActions((prev) => [...prev, { type: "remove", key: k }]);
    } else {
      const v = parseDraftValue();
      setActions((prev) => [...prev, { type: t, key: k, value: v } as BulkMetaAction]);
    }
    setDraftKey("");
    setDraftValueRaw("");
  };

  const makeRemoveAt = (i: number) => () => {
    setActions((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleApply = async () => {
    if (busy() || actions().length === 0) return;
    setBusy(true);
    setError(undefined);
    try {
      console.log("[BulkMetaModal] applying actions:", actions());
      await props.onApply(actions());
      setActions([]);
      props.onClose();
    } catch (e) {
      setError((e as Error).message || "Failed to apply metadata");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy()) return;
    setActions([]);
    props.onClose();
  };

  return (
    <Modal open={props.open} onClose={handleClose}>
      <div class="p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium">Bulk edit metadata</div>
          <div class="text-xs text-gray-500">Selected: {props.selectedCount}</div>
        </div>

        <Show when={!!error()}>
          <div class="text-xs text-red-600">{error()}</div>
        </Show>

        <div class="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <div>
            <label class="block text-xs text-gray-600 mb-1">Action</label>
            <select
              class="w-full border rounded px-2 py-1 text-sm"
              value={draftType()}
              onChange={(e) => setDraftType((e.currentTarget.value as any) || "add")}
            >
              <option value="add">Add key if missing</option>
              <option value="update">Update key value</option>
              <option value="remove">Remove key</option>
            </select>
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs text-gray-600 mb-1">Key</label>
            <input
              class="w-full border rounded px-2 py-1 text-sm"
              placeholder="e.g. tag or has_relative_image"
              value={draftKey()}
              onInput={(e) => setDraftKey(e.currentTarget.value)}
            />
          </div>
          <Show when={draftType() !== "remove"}>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Value type</label>
              <select
                class="w-full border rounded px-2 py-1 text-sm"
                value={draftValueType()}
                onChange={(e) => setDraftValueType((e.currentTarget.value as any) || "string")}
              >
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="boolean">boolean (true/false)</option>
                <option value="null">null</option>
              </select>
            </div>
            <Show when={draftValueType() !== "null"}>
              <div>
                <label class="block text-xs text-gray-600 mb-1">Value</label>
                <input
                  class="w-full border rounded px-2 py-1 text-sm"
                  placeholder="value"
                  value={draftValueRaw()}
                  onInput={(e) => setDraftValueRaw(e.currentTarget.value)}
                />
              </div>
            </Show>
          </Show>
          <div>
            <button
              class={`w-full px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50`}
              disabled={!canAdd() || busy()}
              onClick={handleAddAction}
            >
              Add to list
            </button>
          </div>
        </div>

        <div class="border-t pt-3">
          <div class="text-xs font-medium text-gray-700 mb-2">Pending actions</div>
          <Show when={actions().length > 0} fallback={<p class="text-xs text-gray-500">No actions added.</p>}>
            <div class="space-y-2">
              <For each={actions()}>
                {(a, i) => (
                  <div class="flex items-center justify-between border rounded px-2 py-1 text-sm">
                    <div class="truncate">
                      <Show when={a.type === "remove"}>
                        <span class="font-medium">remove</span> <code class="text-xs">{a.key}</code>
                      </Show>
                      <Show when={a.type !== "remove"}>
                        <span class="font-medium">{(a as any).type}</span> <code class="text-xs">{a.key}</code> → <code class="text-xs">{String((a as any).value)}</code>
                      </Show>
                    </div>
                    <button
                      class="px-2 py-0.5 text-xs rounded border hover:bg-gray-50"
                      onClick={makeRemoveAt(i())}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <button class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50" onClick={handleClose}>
            Cancel
          </button>
          <button
            class={`rounded px-3 py-1.5 text-xs text-white ${
              busy() || actions().length === 0 ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
            }`}
            disabled={busy() || actions().length === 0}
            onClick={handleApply}
          >
            Apply to {props.selectedCount} items
          </button>
        </div>
      </div>
    </Modal>
  );
};


