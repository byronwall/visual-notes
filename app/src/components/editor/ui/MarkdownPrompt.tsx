import { createSignal } from "solid-js";
import Modal from "../../Modal";

export type MdChoice = "formatted" | "text" | "cancel";

export function useMarkdownPrompt() {
  const [open, setOpen] = createSignal(false);
  const [text, setText] = createSignal("");
  let resolver: ((c: MdChoice) => void) | undefined;

  const prompt = (t: string): Promise<MdChoice> =>
    new Promise((resolve) => {
      console.log("[markdown] open prompt len:", t.length);
      setText(t);
      setOpen(true);
      resolver = (c) => {
        console.log("[markdown] prompt resolved:", c);
        setOpen(false);
        resolve(c);
      };
    });

  const view = (
    <Modal open={open()} onClose={() => resolver?.("cancel")}>
      <div class="p-4 space-y-3">
        <div class="text-sm font-medium">Paste detected as Markdown</div>
        <div class="text-xs text-gray-600">Choose how to insert the content:</div>
        <div class="bg-gray-50 border border-gray-200 rounded p-2 max-h-40 overflow-auto text-xs font-mono whitespace-pre">
          {text().slice(0, 500)}
          {text().length > 500 ? "…" : ""}
        </div>
        <div class="flex justify-end gap-2">
          <button
            class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50"
            onClick={() => resolver?.("text")}
          >
            Paste as raw text
          </button>
          <button
            class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50"
            onClick={() => resolver?.("formatted")}
          >
            Paste with formatting
          </button>
        </div>
      </div>
    </Modal>
  );

  return { prompt, view };
}


