import type { Editor } from "@tiptap/core";
import { A } from "@solidjs/router";
import { For, Suspense, createResource, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { apiFetch } from "~/utils/base-url";
import { getSelectionContext, stripDataUrlsFromText } from "../core/selection";
import { useAiPromptModal } from "./AiPromptModal";
import { emitLLMSidebarOpen } from "~/components/ai/LLMSidebarBus";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { HStack, Spacer } from "styled-system/jsx";

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

type PromptsResponse = { items: PromptRecord[] };

async function fetchPrompts(): Promise<PromptRecord[]> {
  const res = await apiFetch("/api/prompts");
  const data = (await res.json()) as PromptsResponse;
  return data.items || [];
}

export function AIPromptsBar(props: { editor?: Editor; noteId?: string }) {
  const [prompts] = createResource(fetchPrompts);
  const [running, setRunning] = createSignal<string | null>(null);
  const { prompt: openAiModal, view: aiModalView } = useAiPromptModal();

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

      // Debug: log gathered context and vars prior to sending
      console.log("[ai] run body preview:", {
        promptId: p.id,
        model: resp.model,
        hasSelection: hasNonEmptySelection,
        selectionTextLen: finalSelectionText.length,
        docTextLen: ctx.docText.length,
        hasVarsSelectionText: false,
      });

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
      // Debug: log final payload lengths
      const varsSelectionText = vars["selection_text"];
      const varsHasSelectionText =
        typeof varsSelectionText === "string" && varsSelectionText.length > 0;
      console.log("[ai] posting /api/ai/runPrompt", {
        selection_text_len: body.selection_text?.length || 0,
        doc_text_len: body.doc_text?.length || 0,
        vars_has_selection_text: varsHasSelectionText,
      });
      const r = await apiFetch("/api/ai/runPrompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await r.json()) as {
        outputHtml?: string | null;
        outputText?: string | null;
        compiledPrompt?: string | null;
        systemPrompt?: string | null;
        threadId?: string | null;
        error?: string;
      };
      if (data?.error) {
        console.log("[ai] run error:", data.error);
        return;
      }
      // Open the chat sidebar and select the created thread
      emitLLMSidebarOpen(data.threadId || undefined);
    } finally {
      setRunning(null);
    }
  };

  return (
    <>
      <HStack gap="1" alignItems="center" overflowX="auto">
        <Suspense
          fallback={
            <Text fontSize="xs" color="fg.muted">
              Loading prompts…
            </Text>
          }
        >
          <For each={prompts() || []}>
            {(p) => (
              <Button
                size="xs"
                variant="outline"
                colorPalette="gray"
                disabled={running() === p.id}
                onClick={() => onRun(p)}
                title={p.description || p.task}
              >
                {p.task}
              </Button>
            )}
          </For>
        </Suspense>
        <Spacer />
        <A
          href="/ai"
          class={css({
            fontSize: "xs",
            color: "fg.muted",
            whiteSpace: "nowrap",
            textDecoration: "none",
            _hover: { color: "fg.default", textDecoration: "underline" },
          })}
          title="Manage prompts"
        >
          Manage prompts
        </A>
      </HStack>
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
