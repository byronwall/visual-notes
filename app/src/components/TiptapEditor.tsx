import type { Editor } from "@tiptap/core";
import { Show, createEffect, createMemo, createSignal } from "solid-js";
import type { Component } from "solid-js";
import { createEditor } from "./editor/core/createEditor";
import { documentContentStyles } from "./document-content-styles";
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
  fillHeight?: boolean;
  minEditorHeight?: string;
  borderless?: boolean;
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
    <Box
      class={props.class}
      w="full"
      h={props.fillHeight ? "full" : undefined}
      minH={props.fillHeight ? "0" : undefined}
      display="flex"
      flexDirection="column"
      gap="2"
    >
      <Show when={props.showToolbar !== false}>
        <Box
          flexShrink="0"
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
        flex={props.fillHeight ? "1" : undefined}
        minH={props.fillHeight ? "0" : undefined}
        overflow={props.fillHeight ? "auto" : undefined}
        borderWidth={props.borderless ? "0" : "1px"}
        borderColor={props.borderless ? undefined : "gray.outline.border"}
        borderRadius={props.borderless ? undefined : "l2"}
        css={documentContentStyles}
      >
        <Box
          minH={props.minEditorHeight ?? "200px"}
          h={props.fillHeight ? "full" : undefined}
          ref={setContainer}
        />
      </Box>

      {csvPromptView}
      {mdPromptView}
    </Box>
  );
};

export default TiptapEditor;
