import { createResource, createSignal, Suspense } from "solid-js";
import Modal from "../../Modal";
import { apiFetch } from "~/utils/base-url";

type ModelsResponse = { items: string[] };

async function fetchModels(): Promise<string[]> {
  const res = await apiFetch("/api/ai/models");
  const data = (await res.json()) as ModelsResponse;
  return data.items || [];
}

export type AiRunPayload = {
  model?: string;
  varsJson?: string;
};

export function useAiPromptModal() {
  const [open, setOpen] = createSignal(false);
  const [defaultModel, setDefaultModel] = createSignal<string | undefined>(
    undefined
  );

  const [model, setModel] = createSignal<string>("");
  const [varsJson, setVarsJson] = createSignal<string>("");
  const [previewText, setPreviewText] = createSignal<string>("");
  const [promptTask, setPromptTask] = createSignal<string>("");
  const [promptSystem, setPromptSystem] = createSignal<string | undefined>();
  const [promptTemplate, setPromptTemplate] = createSignal<string>("");

  const [models] = createResource(fetchModels);
  let resolver: ((p: AiRunPayload | "cancel") => void) | undefined;

  const prompt = (opts: {
    defaultModel?: string;
    previewText: string;
    details?: { task: string; system?: string | null; template: string };
  }) =>
    new Promise<AiRunPayload | "cancel">((resolve) => {
      console.log(
        "[ai-modal] open with preview length:",
        opts.previewText?.length || 0
      );
      setDefaultModel(opts.defaultModel);
      setModel(opts.defaultModel || "");
      setVarsJson("");
      setPreviewText(opts.previewText || "");
      setPromptTask(opts.details?.task || "");
      setPromptSystem(opts.details?.system ?? undefined);
      setPromptTemplate(opts.details?.template || "");
      setOpen(true);
      resolver = (p) => {
        setOpen(false);
        resolve(p);
      };
    });

  const view = (
    <Modal open={open()} onClose={() => resolver?.("cancel")}>
      <div class="p-4 space-y-3">
        <div class="text-sm font-medium">
          {promptTask() ? `Run Prompt: ${promptTask()}` : "Run AI Prompt"}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="space-y-1">
            <div class="text-xs text-gray-600">Model</div>
            <Suspense
              fallback={
                <div class="text-xs text-gray-500">Loading models…</div>
              }
            >
              <select
                class="border rounded px-2 py-1 text-sm w-full"
                value={model() || defaultModel() || ""}
                onChange={(e) =>
                  setModel((e.target as HTMLSelectElement).value)
                }
              >
                <option value={defaultModel() || ""}>
                  {defaultModel() || "Default"}
                </option>
                {(models() || []).map((m) => (
                  <option value={m}>{m}</option>
                ))}
              </select>
            </Suspense>
          </div>
          <div class="space-y-1">
            <div class="text-xs text-gray-600">Variables (JSON, optional)</div>
            <textarea
              class="border rounded px-2 py-1 text-xs w-full h-20 font-mono"
              placeholder='e.g. {"topic": "Rust", "audience": "beginners"}'
              value={varsJson()}
              onInput={(e) =>
                setVarsJson((e.target as HTMLTextAreaElement).value)
              }
            />
          </div>
        </div>
        <details class="border rounded">
          <summary class="text-xs cursor-pointer px-2 py-1">
            Prompt details
          </summary>
          <div class="p-2 space-y-2">
            <div>
              <div class="text-[11px] text-gray-600 mb-1">Task</div>
              <pre class="border rounded p-2 text-[11px] max-h-16 overflow-auto whitespace-pre-wrap">
                {promptTask()}
              </pre>
            </div>
            <div>
              <div class="text-[11px] text-gray-600 mb-1">User template</div>
              <pre class="border rounded p-2 text-[11px] max-h-40 overflow-auto whitespace-pre-wrap">
                {promptTemplate()}
              </pre>
            </div>
            {promptSystem() && (
              <div>
                <div class="text-[11px] text-gray-600 mb-1">System prompt</div>
                <pre class="border rounded p-2 text-[11px] max-h-28 overflow-auto whitespace-pre-wrap">
                  {promptSystem()}
                </pre>
              </div>
            )}
          </div>
        </details>
        <details class="border rounded">
          <summary class="text-xs cursor-pointer px-2 py-1">
            Text to be processed (selection or whole document)
          </summary>
          <div class="p-2">
            <pre class="border rounded p-2 text-xs max-h-40 overflow-auto whitespace-pre-wrap">
              {previewText()}
            </pre>
          </div>
        </details>
        <div class="flex justify-end gap-2">
          <button
            class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50"
            onClick={() => resolver?.("cancel")}
          >
            Cancel
          </button>
          <button
            class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50"
            onClick={() =>
              resolver?.({
                model: model() || defaultModel(),
                varsJson: varsJson(),
              })
            }
          >
            Run
          </button>
        </div>
      </div>
    </Modal>
  );

  return { prompt, view };
}
