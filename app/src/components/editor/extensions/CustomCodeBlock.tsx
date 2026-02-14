import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { CheckIcon, CopyIcon, DownloadIcon, ExpandIcon } from "lucide-solid";
import { createLowlight, common } from "lowlight";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import {
  createPlainRenderedCode,
  renderCodeLines,
} from "~/components/editor/code-block/renderCodeLines";
import {
  extensionForLanguage,
  normalizeRawCodeForRender,
  resolveCodeLanguage,
  splitCodeLines,
} from "~/components/editor/code-block/codeBlockUtils";
import { LineNumberedCodeView } from "~/components/editor/code-block/LineNumberedCodeView";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import {
  createSolidNodeViewRenderer,
  NodeViewContent,
  NodeViewWrapper,
  useSolidNodeView,
} from "../nodeviews";

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

const expandedByPos = new Map<number, boolean>();
const collapsedByPos = new Map<number, boolean>();
const COLLAPSED_VISIBLE_LINES = 15;

function downloadSnippet(rawCode: string, language: string) {
  const extension = extensionForLanguage(language);
  const filename = `code-snippet.${extension}`;
  const blob = new Blob([rawCode], { type: "text/plain;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

function CustomCodeBlockNodeView() {
  const { state } = useSolidNodeView<CodeBlockAttrs>();
  const [copied, setCopied] = createSignal(false);
  const [copiedExpanded, setCopiedExpanded] = createSignal(false);
  const [expandedSignal, setExpandedSignal] = createSignal(false);
  const [collapsedSignal, setCollapsedSignal] = createSignal(true);

  const languageAttr = createMemo(() => {
    const value = state().node.attrs.language;
    return value ? String(value) : undefined;
  });

  const className = createMemo(() => {
    const value = state().HTMLAttributes?.class;
    return typeof value === "string" ? value : undefined;
  });

  const language = createMemo(() => {
    return resolveCodeLanguage(languageAttr(), className());
  });

  const rawCode = createMemo(() => state().node.textContent || "");
  const lineCount = createMemo(() => {
    return splitCodeLines(normalizeRawCodeForRender(rawCode())).length;
  });
  const lineDigits = createMemo(() => String(Math.max(1, lineCount())).length);
  const lineNumbers = createMemo(() =>
    Array.from({ length: lineCount() }, (_, index) => index + 1),
  );
  const editableGutterPadding = createMemo(
    () => `calc(${lineDigits()}ch + 1.75rem)`,
  );
  const plainRendered = createMemo(() =>
    createPlainRenderedCode(rawCode(), language()),
  );
  const [expandedRendered] = createResource(
    () => (expandedSignal() ? { rawCode: rawCode(), language: language() } : null),
    async (source) =>
      renderCodeLines({
        rawCode: source.rawCode,
        dataMdLanguage: source.language,
      }),
    { initialValue: plainRendered() },
  );

  let copiedTimeout: number | undefined;
  let openTimeout: number | undefined;

  const getPosSafe = () => {
    try {
      const pos = state().getPos();
      return typeof pos === "number" ? pos : null;
    } catch {
      return null;
    }
  };

  const expanded = () => expandedSignal();
  const setExpanded = (next: boolean) => {
    setExpandedSignal(next);
    const pos = getPosSafe();
    if (pos !== null) expandedByPos.set(pos, next);
  };

  const collapsed = () => collapsedSignal();
  const setCollapsed = (next: boolean) => {
    setCollapsedSignal(next);
    const pos = getPosSafe();
    if (pos !== null) collapsedByPos.set(pos, next);
  };

  createEffect(() => {
    const pos = getPosSafe();
    if (pos === null) return;
    const saved = expandedByPos.get(pos);
    if (saved === undefined) return;
    if (saved !== expanded()) {
      setExpandedSignal(saved);
    }
  });

  createEffect(() => {
    const pos = getPosSafe();
    const shouldAutoCollapse = lineCount() > COLLAPSED_VISIBLE_LINES;
    if (pos === null) {
      if (!shouldAutoCollapse) setCollapsedSignal(false);
      return;
    }
    const saved = collapsedByPos.get(pos);
    if (saved === undefined) {
      setCollapsedSignal(shouldAutoCollapse);
      collapsedByPos.set(pos, shouldAutoCollapse);
      return;
    }
    if (saved !== collapsedSignal()) {
      setCollapsedSignal(saved);
    }
  });

  const isCollapsible = createMemo(() => lineCount() > COLLAPSED_VISIBLE_LINES);

  onCleanup(() => {
    if (copiedTimeout) window.clearTimeout(copiedTimeout);
    if (openTimeout) window.clearTimeout(openTimeout);
  });

  const copySnippet = async (target: "inline" | "expanded") => {
    try {
      await navigator.clipboard.writeText(rawCode());
      if (target === "inline") {
        setCopied(true);
      } else {
        setCopiedExpanded(true);
      }
      if (copiedTimeout) window.clearTimeout(copiedTimeout);
      copiedTimeout = window.setTimeout(() => {
        setCopied(false);
        setCopiedExpanded(false);
        copiedTimeout = undefined;
      }, 1500);
    } catch {
      setCopied(false);
      setCopiedExpanded(false);
    }
  };

  const htmlAttributes = createMemo(() => state().HTMLAttributes || {});

  return (
    <NodeViewWrapper
      as="pre"
      class="vn-codeblock"
      data-collapsed={isCollapsible() && collapsed() ? "true" : "false"}
      data-md-raw={rawCode()}
      data-md-language={language()}
      {...htmlAttributes()}
    >
      <Box
        as="span"
        data-code-action="true"
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
          aria-label="Set code language"
          title="Set code language"
          data-code-action="true"
        >
          <For each={CODE_LANGUAGES}>
            {(lang) => <option value={lang}>{lang}</option>}
          </For>
        </select>
        <Box as="span" ml="1">
          <IconButton
            size="xs"
            variant="outline"
            colorPalette="gray"
            onClick={() => void copySnippet("inline")}
            aria-label={copied() ? "Copied" : "Copy code"}
            title={copied() ? "Copied" : "Copy code"}
            data-code-action="true"
          >
            <Show when={copied()} fallback={<CopyIcon size={12} />}>
              <CheckIcon size={12} />
            </Show>
          </IconButton>
        </Box>
        <Box as="span" ml="1">
          <IconButton
            size="xs"
            variant="outline"
            colorPalette="gray"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (openTimeout) window.clearTimeout(openTimeout);
              openTimeout = window.setTimeout(() => {
                setExpanded(true);
                openTimeout = undefined;
              }, 0);
            }}
            aria-label="Expand code"
            title="Expand code"
            data-code-action="true"
          >
            <ExpandIcon size={12} />
          </IconButton>
        </Box>
      </Box>

      <Box
        as="span"
        class="vn-codeblock-line-gutter"
        contentEditable={false}
        aria-hidden="true"
      >
        <For each={lineNumbers()}>
          {(line) => (
            <Box as="span" class="vn-codeblock-line-number">
              {line}
            </Box>
          )}
        </For>
      </Box>

      <NodeViewContent
        as="code"
        spellcheck={false}
        class="vn-codeblock-content"
        style={{
          "padding-left": editableGutterPadding(),
          "padding-right": "3",
          "padding-top": "3",
          "padding-bottom": isCollapsible() && collapsed() ? "0" : "3",
          "white-space": "pre",
          "font-family": "inherit",
          "font-size": "inherit",
          "line-height": "1.6em",
        }}
      />

      <Show when={isCollapsible()}>
        <Box
          as="span"
          data-code-action="true"
          contentEditable={false}
          position="sticky"
          left="0"
          right="0"
          bottom="0"
          zIndex="3"
          display="flex"
          justifyContent="center"
          pointerEvents="none"
          pt="6"
          pb="0"
          style={{
            background: collapsed()
              ? "linear-gradient(180deg, rgba(245,246,248,0) 0%, rgba(245,246,248,0.95) 60%, rgba(245,246,248,1) 100%)"
              : undefined,
          }}
        >
          <Button
            size="sm"
            variant="plain"
            colorPalette="gray"
            onClick={() => setCollapsed(!collapsed())}
            data-code-action="true"
            style={{ "pointer-events": "auto" }}
          >
            {collapsed() ? "Show more" : "Show less"} • {lineCount()} lines
          </Button>
        </Box>
      </Show>

      <Show when={expanded()}>
        <Box contentEditable={false}>
          <SimpleDialog
            open={true}
            onOpenChange={setExpanded}
            header={
              <HStack justifyContent="space-between" alignItems="flex-start" gap="4">
                <Box minW="0">
                  <Box as="h2" m="0" fontSize="3xl" lineHeight="1.1" fontWeight="semibold">
                    Code Viewer
                  </Box>
                  <Box
                    as="p"
                    m="0"
                    mt="3"
                    fontSize="2xl"
                    color="fg.muted"
                    textTransform="uppercase"
                    letterSpacing="0.04em"
                  >
                    {lineCount()} lines • {language()}
                  </Box>
                </Box>
                <HStack justifyContent="flex-end" gap="2" mt="1">
                  <Button
                    size="sm"
                    variant="outline"
                    colorPalette="gray"
                    onClick={() => void copySnippet("expanded")}
                  >
                    <Show when={copiedExpanded()} fallback={<CopyIcon size={16} />}>
                      <CheckIcon size={16} />
                    </Show>
                    <Show when={copiedExpanded()} fallback={<span>Copy</span>}>
                      <span>Copied</span>
                    </Show>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    colorPalette="gray"
                    onClick={() => downloadSnippet(rawCode(), language())}
                  >
                    <DownloadIcon size={16} />
                    Download
                  </Button>
                </HStack>
              </HStack>
            }
            maxW="min(96vw, 1100px)"
            contentClass={css({
              width: "min(96vw, 1100px)",
            })}
          >
            <Box
              mt="0"
              pt="3"
              w="full"
            >
              <Box
                borderTopWidth="1px"
                borderColor="gray.outline.border"
                mb="3"
              />
              <Box
                w="full"
                maxW="100%"
                overflow="hidden"
              >
                <Box
                  as="pre"
                  m="0"
                  px="5"
                  py="4"
                  w="full"
                  minW="0"
                  borderWidth="1px"
                  borderRadius="l2"
                  bg="#edeff1"
                  overflow="auto"
                  maxH="min(72vh, 900px)"
                  fontFamily="mono"
                  fontSize="sm"
                  lineHeight="1.6"
                  whiteSpace="pre-wrap"
                  overflowWrap="anywhere"
                  data-md-raw={rawCode()}
                  data-md-language={language()}
                >
                  <LineNumberedCodeView rendered={expandedRendered() ?? plainRendered()} />
                </Box>
              </Box>
            </Box>
          </SimpleDialog>
        </Box>
      </Show>
    </NodeViewWrapper>
  );
}

export const CustomCodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
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
        return !!target?.closest("[data-code-action='true']");
      },
    });
  },
}).configure({ lowlight: createLowlight(common) });
