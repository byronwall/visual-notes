import type { Editor } from "@tiptap/core";
import { useAction, useNavigate, createAsync } from "@solidjs/router";
import { For, Show, Suspense, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { getSelectionContext, stripDataUrlsFromText } from "../core/selection";
import { useAiPromptModal } from "./AiPromptModal";
import { emitLLMSidebarOpen } from "~/components/ai/LLMSidebarBus";
import { Text } from "~/components/ui/text";
import * as Menu from "~/components/ui/menu";
import { IconButton } from "~/components/ui/icon-button";
import { Tooltip } from "~/components/ui/tooltip";
import { Box, HStack, Stack } from "styled-system/jsx";
import { SparklesIcon } from "lucide-solid";
import { fetchPrompts } from "~/services/prompts/prompts.queries";
import { runPrompt } from "~/services/ai/ai-run-prompt.actions";

type PromptRecord = {
  id: string;
  task: string;
  description?: string | null;
  defaultModel: string;
  activeVersion?: {
    id: string;
    template: string;
    system?: string | null;
    modelOverride?: string | null;
    tempOverride?: number | null;
    topPOverride?: number | null;
  } | null;
};

export function AIPromptsMenu(props: { editor?: Editor; noteId?: string }) {
  const navigate = useNavigate();
  const prompts = createAsync(() => fetchPrompts());
  const [running, setRunning] = createSignal<string | null>(null);
  const { prompt: openAiModal, view: aiModalView } = useAiPromptModal();
  const runPromptAction = useAction(runPrompt);

  const onRun = async (p: PromptRecord) => {
    const ed = props.editor;
    if (!ed) return;
    setRunning(p.id);
    try {
      const ctx = getSelectionContext(ed);
      const hasNonEmptySelection =
        ctx.hasSelection && ctx.selectionText.trim().length > 0;
      const selectionOrDocText = hasNonEmptySelection
        ? ctx.selectionText
        : ctx.docText;
      const sanitizedPreview = stripDataUrlsFromText(selectionOrDocText);
      const resp = await openAiModal({
        defaultModel:
          p.activeVersion?.modelOverride || p.defaultModel || "gpt-4o-mini",
        previewText: sanitizedPreview,
        details: {
          task: p.task,
          system: p.activeVersion?.system ?? undefined,
          template: p.activeVersion?.template || "",
        },
      });
      if (resp === "cancel") return;
      const vars =
        resp.varsJson && resp.varsJson.trim().length
          ? safeParseJson(resp.varsJson)
          : {};

      // Assume no selection => process whole document
      const finalSelectionText = selectionOrDocText;
      const sanitizedSelectionText = stripDataUrlsFromText(finalSelectionText);

      const body = {
        promptId: p.id,
        model: resp.model,
        vars,
        selection_text: sanitizedSelectionText,
        selection_html: ctx.selectionHtml || undefined,
        doc_text: ctx.docText,
        doc_html: ctx.docHtml,
        noteId: props.noteId,
      };
      const data = await runPromptAction(body);
      emitLLMSidebarOpen(
        "threadId" in data ? data.threadId || undefined : undefined
      );
    } catch {
    } finally {
      setRunning(null);
    }
  };

  return (
    <>
      <Menu.Root size="sm">
        <Tooltip content="AI prompts" showArrow>
          <Menu.Trigger
            asChild={(triggerProps) => (
              <IconButton
                {...triggerProps}
                size="xs"
                variant="subtle"
                colorPalette="gray"
                minW="6"
                h="6"
                aria-label="AI prompts"
              >
                <SparklesIcon size={16} />
              </IconButton>
            )}
          />
        </Tooltip>
        <Menu.Positioner>
          <Menu.Content class={css({ minW: "240px", maxW: "320px" })}>
            <Suspense
              fallback={
                <Menu.Item disabled value="loading">
                  <Text fontSize="sm" color="fg.muted">
                    Loading prompts…
                  </Text>
                </Menu.Item>
              }
            >
              <Show
                when={(prompts() || []).length > 0}
                fallback={
                  <Menu.Item disabled value="empty">
                    <Text fontSize="sm" color="fg.muted">
                      No prompts yet
                    </Text>
                  </Menu.Item>
                }
              >
                <For each={prompts() || []}>
                  {(p) => (
                    <Menu.Item
                      value={p.id}
                      disabled={running() === p.id}
                      onSelect={() => void onRun(p)}
                    >
                      <Stack gap="0.5" maxW="18rem">
                        <HStack gap="2" alignItems="center">
                          <Box
                            w="1.25rem"
                            h="1.25rem"
                            display="inline-flex"
                            alignItems="center"
                            justifyContent="center"
                            color="fg.muted"
                          >
                            <SparklesIcon size={14} />
                          </Box>
                          <Text fontSize="sm" fontWeight="medium" truncate>
                            {running() === p.id ? `Running ${p.task}…` : p.task}
                          </Text>
                        </HStack>
                        <Show when={p.description}>
                          {(desc) => (
                            <Text
                              fontSize="xs"
                              color="fg.muted"
                              class={css({
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              })}
                            >
                              {desc()}
                            </Text>
                          )}
                        </Show>
                      </Stack>
                    </Menu.Item>
                  )}
                </For>
              </Show>
            </Suspense>
            <Menu.Separator />
            <Menu.Item value="manage-prompts" onSelect={() => navigate("/ai")}>
              <Text fontSize="sm" color="fg.muted">
                Manage prompts
              </Text>
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
      {aiModalView}
    </>
  );
}

function safeParseJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
