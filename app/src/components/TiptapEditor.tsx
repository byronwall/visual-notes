import type { Editor } from "@tiptap/core";
import { Show, createEffect, createMemo, createSignal } from "solid-js";
import type { Component } from "solid-js";
import { createEditor } from "./editor/core/createEditor";
import { ToolbarContents } from "./editor/toolbar/ToolbarContents";
import { useCsvPrompt } from "./editor/ui/CsvPrompt";
import { useMarkdownPrompt } from "./editor/ui/MarkdownPrompt";
import { setMarkdownPrompt } from "./editor/core/promptRegistry";
import "highlight.js/styles/github.css";
import "tippy.js/dist/tippy.css";
import { Box } from "styled-system/jsx";

const DEFAULT_HTML = `
<h2>Hi there,</h2>
<p>this is a <em>basic</em> example of <strong>tiptap</strong>.</p>
`;

type TiptapEditorProps = {
  initialHTML?: string;
  class?: string;
  onEditor?: (editor: Editor) => void;
  /** Show formatting toolbar. Defaults to true. */
  showToolbar?: boolean;
  /** Show AI prompts menu in the toolbar. Defaults to false. */
  showAiPromptsMenu?: boolean;
  noteId?: string;
};

const TiptapEditor: Component<TiptapEditorProps> = (props) => {
  const [container, setContainer] = createSignal<HTMLDivElement>();
  // Capture the first non-null editor instance and keep it stable to avoid
  // transaction-driven reactive churn in the view layer.
  const [stableEditor, setStableEditor] = createSignal<Editor | null>(null);
  const { prompt, view: csvPromptView } = useCsvPrompt();
  const { prompt: mdPrompt, view: mdPromptView } = useMarkdownPrompt();

  // Register markdown prompt for the MarkdownPaste extension
  setMarkdownPrompt((text: string, _src: "paste" | "drop" | "file") =>
    mdPrompt(text)
  );

  const editor = createEditor(
    () => container(),
    props.initialHTML ?? DEFAULT_HTML,
    (text: string, _src: "paste" | "drop" | "file") => prompt(text)
  );

  // Set stable editor instance once when available
  createEffect(() => {
    const ed = editor();
    if (ed && !stableEditor()) {
      setStableEditor(ed);
    }
  });

  // Expose instance to parent once stable
  createEffect(() => {
    const ed = stableEditor();
    if (ed && props.onEditor) {
      props.onEditor(ed);
    }
  });

  // Sync incoming HTML ONLY when the prop changes, not on every transaction.
  // Track the last applied prop value to avoid redundant setContent calls.
  let lastAppliedFromProps: string | undefined = undefined;
  const initialHtmlFromProps = createMemo(
    () => props.initialHTML ?? DEFAULT_HTML
  );
  createEffect(() => {
    const ed = stableEditor();
    if (!ed) return;
    const next = initialHtmlFromProps();
    if (lastAppliedFromProps === next) return;
    const current = ed.getHTML();
    if (typeof next === "string" && next !== current) {
      ed.commands.setContent(next, { emitUpdate: false });
    }
    lastAppliedFromProps = next;
  });

  return (
    <Box class={props.class} w="full">
      <Show when={props.showToolbar !== false}>
        <Box
          mb="2"
          position="sticky"
          top="0"
          zIndex="20"
          borderWidth="1px"
          borderColor="gray.outline.border"
          borderRadius="l2"
          bg="gray.surface.bg"
          color="fg.default"
          style={{
            background: "rgba(255,255,255,0.95)",
            "backdrop-filter": "blur(10px)",
          }}
        >
          <Show when={stableEditor()}>
            <ToolbarContents
              editor={stableEditor()!}
              noteId={props.noteId}
              showAiPromptsMenu={props.showAiPromptsMenu}
            />
          </Show>
        </Box>
      </Show>

      <Box
        position="relative"
        borderWidth="1px"
        borderColor="gray.outline.border"
        borderRadius="l2"
        css={{
          // ProseMirror adds this class to the currently selected node.
          // Add a clear selection ring for images without shifting layout.
          "& .ProseMirror img.ProseMirror-selectednode": {
            outlineWidth: "2px",
            outlineStyle: "solid",
            outlineColor: "blue.9",
            outlineOffset: "2px",
            borderRadius: "l2",
          },
          "& .ProseMirror .ProseMirror-selectednode img.vn-image": {
            outlineWidth: "2px",
            outlineStyle: "solid",
            outlineColor: "blue.9",
            outlineOffset: "2px",
            borderRadius: "l2",
          },
          "& .ProseMirror table": {
            width: "100%",
            borderCollapse: "collapse",
            borderSpacing: 0,
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "border",
          },
          "& .ProseMirror th, & .ProseMirror td": {
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "border",
            px: "3",
            py: "2",
            verticalAlign: "top",
            bg: "bg.default",
            color: "fg.default",
          },
          "& .ProseMirror th": {
            bg: "gray.surface.bg",
            fontWeight: "semibold",
          },
          "& .ProseMirror tbody tr:nth-of-type(odd) td": {
            bg: "bg.default",
          },
          "& .ProseMirror tbody tr:nth-of-type(even) td": {
            bg: "gray.surface.bg.hover",
          },
          "& .ProseMirror pre.vn-codeblock": {
            position: "relative",
          },
          "& .ProseMirror .vn-codeblock-content": {
            display: "block",
            paddingTop: "6",
          },
        }}
      >
        <Box minH="200px" ref={setContainer} />
      </Box>

      {csvPromptView}
      {mdPromptView}
    </Box>
  );
};

export default TiptapEditor;
