import type { Editor } from "@tiptap/core";
import { Show, createEffect, createMemo, createSignal } from "solid-js";
import { createEditor } from "./editor/core/createEditor";
import { ToolbarContents } from "./editor/toolbar/ToolbarContents";
import { useCodeBlockOverlay } from "./editor/core/useCodeBlockOverlay";
import { useCsvPrompt } from "./editor/ui/CsvPrompt";
import "highlight.js/styles/github.css";

const DEFAULT_HTML = `
<h2>Hi there,</h2>
<p>this is a <em>basic</em> example of <strong>tiptap</strong>.</p>
`;

export default function TiptapEditor(props: {
  initialHTML?: string;
  class?: string;
  onEditor?: (editor: Editor) => void;
}) {
  const [container, setContainer] = createSignal<HTMLDivElement>();
  const { prompt, view: csvPromptView } = useCsvPrompt();

  const editor = createEditor(
    () => container(),
    props.initialHTML ?? DEFAULT_HTML,
    (text: string, _src: "paste" | "drop" | "file") => prompt(text)
  );

  // Expose instance to parent
  createEffect(() => {
    const ed = editor();
    if (ed && props.onEditor) props.onEditor(ed);
  });

  // Sync incoming HTML
  createEffect(() => {
    const ed = editor();
    if (!ed) return;
    const next = props.initialHTML ?? DEFAULT_HTML;
    const current = ed.getHTML();
    if (typeof next === "string" && next !== current) {
      console.log("[editor] setContent");
      ed.commands.setContent(next, { emitUpdate: false });
    }
  });

  // Code block overlay
  const overlay = useCodeBlockOverlay(
    () => editor() ?? null,
    () => container()
  );

  const languageOptions = createMemo(() => {
    return ["text", "plaintext", "javascript", "typescript", "python"];
  });

  return (
    <div class={props.class || "w-full"}>
      <div class="mb-2 rounded bg-gray-50 text-gray-800 border border-gray-300">
        <Show when={editor()} keyed>
          {(instance) => <ToolbarContents editor={instance} />}
        </Show>
      </div>

      <div class="relative rounded border border-gray-300">
        <div class="min-h-[200px]" ref={setContainer} />

        <Show when={editor() && overlay()}>
          <div
            class="absolute z-10"
            style={{ top: `${overlay()!.top}px`, left: `${overlay()!.left}px` }}
          >
            <div class="flex items-center gap-1 bg-white/95 border border-gray-300 rounded px-2 py-[2px] shadow-sm">
              <select
                class="text-xs bg-transparent"
                value={editor()?.getAttributes("codeBlock")?.language || "text"}
                onInput={(e) => {
                  const lang = (e.currentTarget as HTMLSelectElement).value;
                  console.log("[codeblock] set language:", lang);
                  editor()
                    ?.chain()
                    .focus()
                    .updateAttributes("codeBlock", { language: lang })
                    .run();
                }}
              >
                {languageOptions().map((l) => (
                  <option value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        </Show>
      </div>

      {csvPromptView}
    </div>
  );
}
