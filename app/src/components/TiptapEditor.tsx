import type { Editor } from "@tiptap/core";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import type { Component } from "solid-js";
import { Portal } from "solid-js/web";
import { createEditor } from "./editor/core/createEditor";
import { ToolbarContents } from "./editor/toolbar/ToolbarContents";
import { useCodeBlockOverlay } from "./editor/core/useCodeBlockOverlay";
import { useCsvPrompt } from "./editor/ui/CsvPrompt";
import { useMarkdownPrompt } from "./editor/ui/MarkdownPrompt";
import { setMarkdownPrompt } from "./editor/core/promptRegistry";
import "highlight.js/styles/github.css";
import * as Select from "~/components/ui/select";
import { Box, HStack } from "styled-system/jsx";

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

  // Code block overlay
  const overlay = useCodeBlockOverlay(
    () => editor() ?? null,
    () => container()
  );

  const languageOptions = createMemo(() => [
    "text",
    "plaintext",
    "bash",
    "shell",
    "javascript",
    "typescript",
    "json",
    "yaml",
    "markdown",
    "html",
    "xml",
    "css",
    "scss",
    "python",
    "java",
    "c",
    "cpp",
    "csharp",
    "go",
    "rust",
    "php",
    "ruby",
    "swift",
    "kotlin",
    "sql",
    "dockerfile",
    "ini",
    "toml",
    "diff",
    "makefile",
  ]);
  type LanguageItem = { label: string; value: string };
  const languageCollection = createMemo(() =>
    Select.createListCollection<LanguageItem>({
      items: languageOptions().map((l) => ({ label: l, value: l })),
    })
  );

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
            <ToolbarContents editor={stableEditor()!} />
          </Show>
        </Box>
      </Show>

      <Box position="relative" borderWidth="1px" borderColor="gray.outline.border" borderRadius="l2">
        <Box minH="200px" ref={setContainer} />

        <Show when={stableEditor() && overlay()}>
          <Box
            position="absolute"
            zIndex="10"
            style={{ top: `${overlay()!.top}px`, left: `${overlay()!.left}px` }}
          >
            <HStack
              gap="1"
              alignItems="center"
              bg="bg.default"
              borderWidth="1px"
              borderColor="gray.outline.border"
              borderRadius="l2"
              px="2"
              py="1"
              boxShadow="sm"
            >
              <Select.Root
                collection={languageCollection()}
                value={[
                  stableEditor()?.getAttributes("codeBlock")?.language || "text",
                ]}
                onValueChange={(details) => {
                  const lang = details.value[0] || "text";
                  console.log("[codeblock] set language:", lang);
                  stableEditor()
                    ?.chain()
                    .focus()
                    .updateAttributes("codeBlock", { language: lang })
                    .run();
                }}
                size="xs"
              >
                <Select.Control>
                  <Select.Trigger>
                    <Select.ValueText placeholder="text" />
                    <Select.Indicator />
                  </Select.Trigger>
                </Select.Control>
                <Portal>
                  <Select.Positioner>
                    <Select.Content>
                      <Select.List>
                        <For each={languageCollection().items}>
                          {(opt) => (
                            <Select.Item item={opt}>
                              <Select.ItemText>{opt.label}</Select.ItemText>
                              <Select.ItemIndicator />
                            </Select.Item>
                          )}
                        </For>
                      </Select.List>
                    </Select.Content>
                  </Select.Positioner>
                </Portal>
                <Select.HiddenSelect />
              </Select.Root>
            </HStack>
          </Box>
        </Show>
      </Box>

      {csvPromptView}
      {mdPromptView}
    </Box>
  );
};

export default TiptapEditor;
