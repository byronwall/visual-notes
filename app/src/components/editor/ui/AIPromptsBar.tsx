import type { Editor } from "@tiptap/core";
import { For, Suspense, createResource, createSignal } from "solid-js";
import { apiFetch } from "~/utils/base-url";
import { getSelectionContext, stripDataUrlsFromText } from "../core/selection";
import { useAiPromptModal } from "./AiPromptModal";
import { usePromptsManagerModal } from "./PromptsManagerModal";
import { emitLLMSidebarOpen } from "~/components/ai/LLMSidebarBus";

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
  const { open: openManager, view: managerView } = usePromptsManagerModal();
  const resultEditorView = null;

  const onRun = async (p: PromptRecord) => {
    const ed = props.editor;
    if (!ed) return;
    setRunning(p.id);
    try {
      const ctx = getSelectionContext(ed);
      const needsInput =
        !ctx.hasSelection || ctx.selectionText.trim().length === 0;
      const resp = await openAiModal({
        needsInput,
        defaultModel:
          p.activeVersion?.modelOverride || p.defaultModel || "gpt-4o-mini",
      });
      if (resp === "cancel") return;
      const vars =
        resp.varsJson && resp.varsJson.trim().length
          ? safeParseJson(resp.varsJson)
          : {};
      if (needsInput && resp.inputText && resp.inputText.trim().length) {
        // Treat user input as the selection_text
        Object.assign(vars, {
          selection_text: stripDataUrlsFromText(resp.inputText),
        });
      }

      const finalSelectionText =
        needsInput && resp.inputText && resp.inputText.trim().length
          ? resp.inputText
          : ctx.selectionText;
      const sanitizedSelectionText = stripDataUrlsFromText(finalSelectionText);

      // Debug: log gathered context and vars prior to sending
      console.log("[ai] run body preview:", {
        promptId: p.id,
        model: resp.model,
        hasSelection: ctx.hasSelection,
        selectionTextLen: finalSelectionText.length,
        docTextLen: ctx.docText.length,
        hasVarsSelectionText:
          typeof (vars as any).selection_text === "string" &&
          (vars as any).selection_text.length > 0,
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
      console.log("[ai] posting /api/ai/runPrompt", {
        selection_text_len: body.selection_text?.length || 0,
        doc_text_len: body.doc_text?.length || 0,
        vars_has_selection_text:
          typeof (body.vars as any)?.selection_text === "string" &&
          (body.vars as any)?.selection_text.length > 0,
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
      <div class="flex items-center gap-1 overflow-x-auto">
        <Suspense
          fallback={<span class="text-xs text-gray-500">Loading prompts…</span>}
        >
          <For each={prompts() || []}>
            {(p) => (
              <button
                class={`rounded px-2 py-1 border text-xs ${
                  running() === p.id
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:bg-gray-50"
                }`}
                disabled={running() === p.id}
                onClick={() => onRun(p)}
                title={p.description || p.task}
              >
                {p.task}
              </button>
            )}
          </For>
        </Suspense>
        <div class="ml-auto">
          <button
            class="rounded px-2 py-1 border text-xs hover:bg-gray-50"
            onClick={() => openManager()}
          >
            Manage
          </button>
        </div>
      </div>
      {aiModalView}
      {managerView}
      {resultEditorView}
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
