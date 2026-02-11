import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import { For, createMemo } from "solid-js";
import { css } from "styled-system/css";
import { Box } from "styled-system/jsx";
import { createSolidNodeViewRenderer, NodeViewContent, NodeViewWrapper, useSolidNodeView } from "../nodeviews";

type CodeBlockAttrs = {
  language?: string;
};

const CODE_LANGUAGES = [
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
] as const;

function CustomCodeBlockNodeView() {
  const { state } = useSolidNodeView<CodeBlockAttrs>();

  const language = createMemo(() => {
    const value = state().node.attrs.language;
    return value ? String(value) : "text";
  });

  const htmlAttributes = createMemo(() => state().HTMLAttributes || {});

  return (
    <NodeViewWrapper as="pre" class="vn-codeblock" {...htmlAttributes()}>
      <Box
        as="span"
        data-codeblock-controls="true"
        contentEditable={false}
        position="absolute"
        top="2"
        right="2"
        zIndex="2"
        display="inline-flex"
        bg="bg.default"
        borderWidth="1px"
        borderColor="gray.outline.border"
        borderRadius="l2"
        px="2"
        py="1"
        boxShadow="sm"
      >
        <select
          value={language()}
          onChange={(event) => {
            const nextLanguage = event.currentTarget.value || "text";
            console.log("[codeblock] set language:", nextLanguage);
            state().updateAttributes({ language: nextLanguage });
          }}
          class={css({
            fontSize: "xs",
            lineHeight: "1",
            borderWidth: "1px",
            borderColor: "gray.outline.border",
            borderRadius: "l1",
            bg: "bg.default",
            color: "fg.default",
            px: "1.5",
            py: "0.5",
          })}
        >
          <For each={CODE_LANGUAGES}>
            {(lang) => <option value={lang}>{lang}</option>}
          </For>
        </select>
      </Box>
      <NodeViewContent as="code" spellcheck={false} class="vn-codeblock-content" />
    </NodeViewWrapper>
  );
}

export const CustomCodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    console.log("[CustomCodeBlock] addAttributes");
    // TODO:AS_ANY, extend base attrs; parent() is not well-typed in Tiptap's API
    const parent = (this as any).parent?.() ?? {};
    return {
      ...parent,
      spellcheck: {
        default: false,
        renderHTML: (attrs: { spellcheck?: boolean }) => ({
          spellcheck: attrs.spellcheck ? "true" : "false",
        }),
      },
    } as any;
  },
  addNodeView() {
    return createSolidNodeViewRenderer(CustomCodeBlockNodeView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement | null;
        return !!target?.closest("[data-codeblock-controls='true']");
      },
    });
  },
}).configure({ lowlight: createLowlight(common) });
