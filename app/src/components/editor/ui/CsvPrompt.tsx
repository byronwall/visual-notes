import { createSignal } from "solid-js";
import Modal from "../../Modal";

export type Choice = "table" | "text" | "cancel";

export function useCsvPrompt() {
  const [open, setOpen] = createSignal(false);
  const [text, setText] = createSignal("");
  let resolver: ((c: Choice) => void) | undefined;

  const prompt = (t: string): Promise<Choice> =>
    new Promise((resolve) => {
      console.log("[csv] open prompt len:", t.length);
      setText(t);
      setOpen(true);
      resolver = (c) => {
        console.log("[csv] prompt resolved:", c);
        setOpen(false);
        resolve(c);
      };
    });

  const view = (
    <Modal open={open()} onClose={() => resolver?.("cancel")}>
      <div class="p-4 space-y-3">
        <div class="text-sm font-medium">Paste detected as CSV/TSV</div>
        <div class="text-xs text-gray-600">Choose how to insert the content:</div>
        <div class="bg-gray-50 border border-gray-200 rounded p-2 max-h-40 overflow-auto text-xs font-mono whitespace-pre">
          {text().slice(0, 500)}
          {text().length > 500 ? "…" : ""}
        </div>
        <div class="flex justify-end gap-2">
          <button class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50" onClick={() => resolver?.("text")}>
            Paste contents directly
          </button>
          <button class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50" onClick={() => resolver?.("table")}>
            Paste as table
          </button>
        </div>
      </div>
    </Modal>
  );

  return { prompt, view };
}


