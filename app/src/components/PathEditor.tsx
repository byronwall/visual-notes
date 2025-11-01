import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import type { VoidComponent } from "solid-js";
import { fetchPathSuggestions, updateDocPath } from "~/services/docs.service";

export const PathEditor: VoidComponent<{
  docId?: string;
  initialPath?: string;
  onChange?: (path: string) => void;
}> = (props) => {
  const [path, setPath] = createSignal(props.initialPath || "");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [suggestions] = createResource(fetchPathSuggestions);

  const paths = createMemo(() => suggestions()?.map((p) => p.path) || []);

  const handleInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    setPath(e.currentTarget.value);
    if (props.onChange) props.onChange(e.currentTarget.value);
  };

  const handleSave = async () => {
    if (!props.docId) return;
    setSaving(true);
    setError(undefined);
    try {
      await updateDocPath(props.docId, path().trim());
    } catch (e) {
      setError((e as Error).message || "Failed to save path");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="flex items-center gap-2">
      <div class="flex-1 min-w-0">
        <input
          class="w-full border rounded px-2 py-1 text-sm"
          list="doc-path-suggestions"
          placeholder="e.g. work.projects.alpha"
          value={path()}
          onInput={handleInput}
        />
        <Show when={error()}>
          {(e) => <div class="text-xs text-red-700 mt-1">{e()}</div>}
        </Show>
        <datalist id="doc-path-suggestions">
          <For each={paths()}>{(p) => <option value={p} />}</For>
        </datalist>
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
    </div>
  );
};
