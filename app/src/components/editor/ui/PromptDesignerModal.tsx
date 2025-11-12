import { For, Show, createSignal } from "solid-js";
import Modal from "../../Modal";
import { apiFetch } from "~/utils/base-url";

type Turn = { role: "user" | "assistant"; content: string };

type Proposal = {
  task?: string;
  description?: string;
  defaultModel?: string;
  defaultTemp?: number;
  template: string;
  system?: string;
};

export function usePromptDesignerModal(onCreated?: () => Promise<void> | void) {
  const [open, setOpen] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [transcript, setTranscript] = createSignal<Turn[]>([]);
  const [currentQuestion, setCurrentQuestion] = createSignal<string>("");
  const [currentSummary, setCurrentSummary] = createSignal<string>("");
  const [answer, setAnswer] = createSignal<string>("");
  const [proposal, setProposal] = createSignal<Proposal | null>(null);

  const reset = () => {
    setTranscript([]);
    setCurrentQuestion("");
    setCurrentSummary("");
    setAnswer("");
    setProposal(null);
  };

  const openModal = () => {
    reset();
    setOpen(true);
  };
  const close = () => setOpen(false);

  const askNext = async () => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/ai/promptDesigner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcript(), mode: "qa" }),
      });
      const data = (await res.json()) as {
        question?: string;
        summary?: string;
        questions?: string[]; // legacy fallback
        proposal?: Proposal; // legacy fallback
        error?: string;
      };
      if (data?.error) {
        console.log("[prompt-designer] error:", data.error);
        return;
      }
      // New shape: question + summary each turn
      if (
        typeof data?.question === "string" &&
        typeof data?.summary === "string"
      ) {
        setTranscript((t) => [
          ...t,
          { role: "assistant", content: data.question! },
        ]);
        setCurrentQuestion(data.question!);
        setCurrentSummary(data.summary!);
        console.log("[prompt-designer] question:", data.question);
        console.log("[prompt-designer] summary:", data.summary);
        return;
      }
      // Fallback to legacy: questions[]
      const qs = data?.questions || [];
      if (qs.length > 0) {
        setTranscript((t) => [...t, { role: "assistant", content: qs[0] }]);
        setCurrentQuestion(qs[0]);
        setCurrentSummary("Clarifying next step to define the prompt.");
        console.log("[prompt-designer] question (legacy):", qs[0]);
        return;
      }
      // If neither shape matches, inject a generic prompt
      const fallback =
        "Briefly describe your goal and the desired output format.";
      setTranscript((t) => [...t, { role: "assistant", content: fallback }]);
      setCurrentQuestion(fallback);
      setCurrentSummary("We need a brief description of your goal and output.");
    } finally {
      setBusy(false);
    }
  };

  const onStart = async () => {
    if (transcript().length > 0) return;
    await askNext();
  };
  const onSubmitAnswer = async () => {
    const a = answer().trim();
    if (!a) return;
    setTranscript((t) => [...t, { role: "user", content: a }]);
    setAnswer("");
    setCurrentQuestion("");
    await askNext();
  };
  const onGenerateNow = async () => {
    // If the user has a pending answer, include it in the transcript first
    const a = answer().trim();
    if (a) {
      setTranscript((t) => [...t, { role: "user", content: a }]);
      setAnswer("");
      setCurrentQuestion("");
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/ai/promptDesigner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcript(), mode: "generate" }),
      });
      const data = (await res.json()) as {
        proposal?: Proposal;
        error?: string;
      };
      if (data?.error) {
        console.log("[prompt-designer] generate error:", data.error);
        return;
      }
      if (data?.proposal) {
        setProposal(data.proposal);
        console.log("[prompt-designer] received proposal");
        return;
      }
      console.log("[prompt-designer] no proposal returned");
    } finally {
      setBusy(false);
    }
  };

  const [task, setTask] = createSignal<string>("");
  const [desc, setDesc] = createSignal<string>("");
  const [tmpl, setTmpl] = createSignal<string>("");
  const [sys, setSys] = createSignal<string>("");
  const [defModel, setDefModel] = createSignal<string>("gpt-4o-mini");
  const [defTemp, setDefTemp] = createSignal<number>(0.2);
  const [creating, setCreating] = createSignal(false);

  const initFromProposal = () => {
    const p = proposal();
    if (!p) return;
    setTask(p.task || "");
    setDesc(p.description || "");
    setTmpl(p.template || "");
    setSys(p.system || "");
    setDefModel(p.defaultModel || "gpt-4o-mini");
    setDefTemp(typeof p.defaultTemp === "number" ? p.defaultTemp : 0.2);
  };

  const onCreate = async () => {
    const finalTask = task().trim();
    const template = tmpl().trim();
    if (!finalTask || !template) return;
    setCreating(true);
    try {
      const res = await apiFetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: finalTask,
          description: desc().trim() || undefined,
          defaultModel: defModel().trim() || "gpt-4o-mini",
          defaultTemp: defTemp(),
          template,
          system: sys().trim() || undefined,
          activate: true,
        }),
      });
      console.log("[prompt-designer] create status", res.status);
      if (onCreated) await onCreated();
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const view = (
    <Modal open={open()} onClose={close}>
      <div class="p-4 space-y-3">
        <div class="text-sm font-medium">New Prompt via Q&A</div>

        <Show when={!proposal()}>
          <div class="space-y-2">
            <div class="text-xs text-gray-600">
              I’ll ask 2–4 questions, then propose a complete prompt.
            </div>
            <div class="border rounded p-2 max-h-56 overflow-auto space-y-1">
              <For each={transcript()}>
                {(t) => (
                  <div class="text-[11px]">
                    <span class="font-medium">
                      {t.role === "assistant" ? "Assistant" : "You"}:
                    </span>{" "}
                    <span>{t.content}</span>
                  </div>
                )}
              </For>
              <Show when={currentQuestion()}>
                <div class="text-[11px]">
                  <span class="font-medium">Assistant:</span>{" "}
                  {currentQuestion()}
                </div>
              </Show>
            </div>
            <Show when={currentSummary()}>
              <div class="rounded border p-2 bg-gray-50">
                <div class="text-[11px] text-gray-600 mb-1">
                  Current summary
                </div>
                <div class="text-[12px]">{currentSummary()}</div>
              </div>
            </Show>
            <div class="flex gap-2">
              <input
                class="border rounded px-2 py-1 text-sm flex-1"
                placeholder="Type your answer…"
                value={answer()}
                onInput={(e) => setAnswer((e.target as HTMLInputElement).value)}
              />
              <button
                class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50 disabled:opacity-60"
                disabled={busy()}
                onClick={onSubmitAnswer}
              >
                Answer
              </button>
              <button
                class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50 disabled:opacity-60"
                disabled={busy()}
                onClick={onGenerateNow}
                title="Skip to proposal"
              >
                Generate
              </button>
            </div>
            <div>
              <button
                class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50 disabled:opacity-60"
                disabled={busy() || transcript().length > 0}
                onClick={onStart}
              >
                Start Q&A
              </button>
            </div>
          </div>
        </Show>

        <Show when={proposal()}>
          {(p) => {
            initFromProposal();
            return (
              <div class="space-y-2">
                <div class="text-xs text-gray-600">
                  Review the proposal and create the prompt.
                </div>
                <input
                  class="border rounded px-2 py-1 text-sm w-full"
                  placeholder="task (unique)"
                  value={task()}
                  onInput={(e) => setTask((e.target as HTMLInputElement).value)}
                />
                <input
                  class="border rounded px-2 py-1 text-sm w-full"
                  placeholder="description"
                  value={desc()}
                  onInput={(e) => setDesc((e.target as HTMLInputElement).value)}
                />
                <div class="grid grid-cols-2 gap-2">
                  <input
                    class="border rounded px-2 py-1 text-sm w-full"
                    placeholder="default model"
                    value={defModel()}
                    onInput={(e) =>
                      setDefModel((e.target as HTMLInputElement).value)
                    }
                  />
                  <input
                    class="border rounded px-2 py-1 text-sm w-full"
                    placeholder="default temp"
                    value={String(defTemp())}
                    onInput={(e) =>
                      setDefTemp(
                        Number((e.target as HTMLInputElement).value) || 0.2
                      )
                    }
                  />
                </div>
                <textarea
                  class="border rounded px-2 py-1 text-xs w-full h-40 font-mono"
                  placeholder="template (Mustache)"
                  value={tmpl()}
                  onInput={(e) =>
                    setTmpl((e.target as HTMLTextAreaElement).value)
                  }
                />
                <textarea
                  class="border rounded px-2 py-1 text-xs w-full h-24 font-mono"
                  placeholder="system (optional)"
                  value={sys()}
                  onInput={(e) =>
                    setSys((e.target as HTMLTextAreaElement).value)
                  }
                />
                <div class="flex justify-end">
                  <button
                    class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50 disabled:opacity-60"
                    disabled={creating()}
                    onClick={onCreate}
                  >
                    Create & Activate
                  </button>
                </div>
              </div>
            );
          }}
        </Show>
      </div>
    </Modal>
  );

  return { open: openModal, view };
}
