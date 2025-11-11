import { Show, createSignal, type VoidComponent } from "solid-js";
import Modal from "~/components/Modal";
import { PathEditor } from "~/components/PathEditor";

export const BulkPathModal: VoidComponent<{
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  onApply: (path: string) => Promise<void>;
}> = (props) => {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [draftPath, setDraftPath] = createSignal("");

  const handleApply = async () => {
    if (busy()) return;
    setBusy(true);
    setError(undefined);
    try {
      console.log("[BulkPathModal] applying path:", draftPath());
      await props.onApply(draftPath());
      props.onClose();
      setDraftPath("");
    } catch (e) {
      setError((e as Error).message || "Failed to apply path");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy()) return;
    setDraftPath("");
    props.onClose();
  };

  return (
    <Modal open={props.open} onClose={handleClose}>
      <div class="p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium">Bulk set path</div>
          <div class="text-xs text-gray-500">
            Selected: {props.selectedCount}
          </div>
        </div>

        <Show when={!!error()}>
          <div class="text-xs text-red-600">{error()}</div>
        </Show>

        <div>
          <div class="text-xs text-gray-600 mb-1">Path</div>
          <PathEditor onChange={(p) => setDraftPath(p)} />
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <button
            class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            class={`rounded px-3 py-1.5 text-xs text-white ${
              busy() ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
            disabled={busy()}
            onClick={handleApply}
          >
            Apply to {props.selectedCount} items
          </button>
        </div>
      </div>
    </Modal>
  );
};
