import { createResource, createSignal, Show, Suspense } from "solid-js";
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
  inputText?: string;
  varsJson?: string;
};

export function useAiPromptModal() {
  const [open, setOpen] = createSignal(false);
  const [needsInput, setNeedsInput] = createSignal(false);
  const [defaultModel, setDefaultModel] = createSignal<string | undefined>(
    undefined
  );

  const [model, setModel] = createSignal<string>("");
  const [inputText, setInputText] = createSignal<string>("");
  const [varsJson, setVarsJson] = createSignal<string>("");

  const [models] = createResource(fetchModels);
  let resolver: ((p: AiRunPayload | "cancel") => void) | undefined;

  const prompt = (opts: { needsInput: boolean; defaultModel?: string }) =>
    new Promise<AiRunPayload | "cancel">((resolve) => {
      console.log("[ai-modal] open, needsInput:", opts.needsInput);
      setNeedsInput(opts.needsInput);
      setDefaultModel(opts.defaultModel);
      setModel(opts.defaultModel || "");
      setInputText("");
      setVarsJson("");
      setOpen(true);
      resolver = (p) => {
        setOpen(false);
        resolve(p);
      };
    });

  const view = (
    <Modal open={open()} onClose={() => resolver?.("cancel")}>
      <div class="p-4 space-y-3">
        <div class="text-sm font-medium">Run AI Prompt</div>
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
        <Show when={needsInput()}>
          <div class="space-y-1">
            <div class="text-xs text-gray-600">Input text</div>
            <textarea
              class="border rounded px-2 py-1 text-sm w-full h-32"
              placeholder="Paste or type the text to process…"
              value={inputText()}
              onInput={(e) =>
                setInputText((e.target as HTMLTextAreaElement).value)
              }
            />
          </div>
        </Show>
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
                inputText: inputText(),
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
