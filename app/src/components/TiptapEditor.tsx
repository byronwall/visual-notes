import type { Editor, JSONContent } from "@tiptap/core";
import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";
import type { Component } from "solid-js";
import { createEditor } from "./editor/core/createEditor";
import { documentContentClass } from "./document-content-styles";
import { ToolbarContents } from "./editor/toolbar/ToolbarContents";
import { PhoneKeyboardToolbar } from "./editor/toolbar/PhoneKeyboardToolbar";
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
  /** Block JSON to load; takes precedence over `initialHTML`. */
  initialContent?: JSONContent;
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
  /**
   * Below the md breakpoint, "keyboard" hides the inline toolbar and shows
   * it docked above the on-screen keyboard only while editing.
   */
  phoneToolbar?: "inline" | "keyboard";
};

const TiptapEditor: Component<TiptapEditorProps> = (props) => {
  const [container, setContainer] = createSignal<HTMLDivElement>();
  const [sentinel, setSentinel] = createSignal<HTMLDivElement>();
  const [stuck, setStuck] = createSignal(false);

  createEffect(() => {
    const el = sentinel();
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(el);
    onCleanup(() => observer.disconnect());
  });
  // Capture the first non-null editor instance and keep it stable to avoid
  // transaction-driven reactive churn in the view layer.
  const [stableEditor, setStableEditor] = createSignal<Editor | null>(null);
  const { prompt, view: csvPromptView } = useCsvPrompt();
  const { prompt: mdPrompt, view: mdPromptView } = useMarkdownPrompt();

  // Register markdown prompt for the MarkdownPaste extension
  setMarkdownPrompt((text: string, _src: "paste" | "drop" | "file") =>
    mdPrompt(text),
  );

  const editor = createEditor(
    () => container(),
    props.initialContent ?? props.initialHTML ?? DEFAULT_HTML,
    (text: string, _src: "paste" | "drop" | "file") => prompt(text),
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
  let lastAppliedFromProps: string | JSONContent | undefined = undefined;
  const initialFromProps = createMemo(
    () => props.initialContent ?? props.initialHTML ?? DEFAULT_HTML,
  );
  createEffect(() => {
    const ed = stableEditor();
    if (!ed) return;
    const next = initialFromProps();
    if (lastAppliedFromProps === next) return;
    const changed =
      typeof next === "string"
        ? next !== ed.getHTML()
        : JSON.stringify(next) !== JSON.stringify(ed.getJSON());
    if (changed) ed.commands.setContent(next, { emitUpdate: false });
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
        {/* Sentinel: once it scrolls out of view the toolbar is stuck. */}
        <Box ref={setSentinel} h="0" mb="-2" aria-hidden="true" />
        <Box
          display={
            props.phoneToolbar === "keyboard"
              ? { base: "none", md: "block" }
              : undefined
          }
          flexShrink="0"
          position="sticky"
          top="0"
          zIndex="20"
          bg="bg.default"
          color="fg.default"
          data-stuck={stuck() ? "true" : "false"}
          borderWidth={props.borderless ? "0" : "1px"}
          borderColor="gray.outline.border"
          borderRadius={props.borderless ? "0" : "l2"}
          mx={props.borderless ? "-2" : undefined}
          transitionProperty="box-shadow"
          transitionDuration="140ms"
          _motionReduce={{ transition: "none" }}
          css={{
            "&[data-stuck=true]": {
              boxShadow: "0 1px 0 0 var(--colors-border)",
            },
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
        data-borderless={props.borderless ? "true" : undefined}
        class={documentContentClass}
      >
        <Box
          minH={props.minEditorHeight ?? "200px"}
          h={props.fillHeight ? "full" : undefined}
          display="flex"
          flexDirection="column"
          ref={setContainer}
        />
      </Box>

      <Show when={props.phoneToolbar === "keyboard" && stableEditor()}>
        {(ed) => (
          <PhoneKeyboardToolbar
            editor={ed()}
            noteId={props.noteId}
            showAiPromptsMenu={props.showAiPromptsMenu}
          />
        )}
      </Show>

      {csvPromptView}
      {mdPromptView}
    </Box>
  );
};

export default TiptapEditor;
