import { For, Show, Suspense, createResource, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import Modal from "../../Modal";
import { apiFetch } from "~/utils/base-url";
import { usePromptDesignerModal } from "./PromptDesignerModal";

type Prompt = {
  id: string;
  task: string;
  description?: string | null;
  defaultModel: string;
  defaultTemp: number;
  defaultTopP?: number | null;
  activeVersion?: {
    id: string;
    template: string;
    system?: string | null;
  } | null;
};
type PromptsResponse = { items: Prompt[] };

async function fetchPrompts(): Promise<Prompt[]> {
  const res = await apiFetch("/api/prompts");
  const data = (await res.json()) as PromptsResponse;
  return data.items || [];
}

export function usePromptsManagerModal() {
  const [open, setOpen] = createSignal(false);
  const [prompts, { refetch }] = createResource(fetchPrompts);

  const [newTask, setNewTask] = createSignal("");
  const [newDesc, setNewDesc] = createSignal("");
  const [newTemplate, setNewTemplate] = createSignal("");
  const [newSystem, setNewSystem] = createSignal("");

  // Per-prompt edit/revise local state
  const [byId, setById] = createStore<
    Record<
      string,
      {
        inited?: boolean;
        editTemplate: string;
        editSystem: string;
        busyEdit?: boolean;
        feedback: string;
        busyRevise?: boolean;
        suggestedTemplate: string;
        suggestedSystem: string;
      }
    >
  >({});

  const openModal = () => {
    setOpen(true);
  };
  const close = () => setOpen(false);

  const selectionMissing = () => newTemplate().indexOf("{{selection") === -1;

  const onInsertSelectionVar = () => {
    const t = newTemplate();
    const needsGap = !t.endsWith("\n");
    const appended = `${t}${needsGap ? "\n\n" : ""}{{selection}}`;
    setNewTemplate(appended);
    console.log("[prompts-manager] inserted {{selection}}");
  };

  const onCreatePrompt = async () => {
    const task = newTask().trim();
    const template = newTemplate().trim();
    if (!task || !template) return;
    const res = await apiFetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task,
        description: newDesc() || undefined,
        template,
        system: newSystem() || undefined,
        activate: true,
      }),
    });
    console.log("[prompts-manager] create status", res.status);
    await refetch();
    setNewTask("");
    setNewDesc("");
    setNewTemplate("");
    setNewSystem("");
  };

  const onAddVersion = async (
    id: string,
    template: string,
    system?: string
  ) => {
    const res = await apiFetch(`/api/prompts/${id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template,
        system: system || undefined,
        activate: true,
      }),
    });
    console.log("[prompts-manager] add version status", res.status);
    await refetch();
  };

  const initEditFor = (p: Prompt) => {
    const av = p.activeVersion;
    if (!av) return;
    if (byId[p.id]?.inited) return;
    setById(p.id, {
      inited: true,
      editTemplate: av.template || "",
      editSystem: av.system || "",
      busyEdit: false,
      feedback: "",
      busyRevise: false,
      suggestedTemplate: "",
      suggestedSystem: "",
    });
    console.log("[prompts-manager] init edit for", p.id);
  };

  const onSaveNewVersion = async (p: Prompt, activate: boolean) => {
    const state = byId[p.id];
    const template = (state?.editTemplate || "").trim();
    const system = (state?.editSystem || "").trim();
    if (!template) return;
    setById(p.id, "busyEdit", true);
    try {
      const res = await apiFetch(`/api/prompts/${p.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          system: system || undefined,
          activate,
        }),
      });
      console.log("[prompts-manager] save new version status", res.status);
      await refetch();
    } finally {
      setById(p.id, "busyEdit", false);
    }
  };

  const onRevise = async (p: Prompt) => {
    const fb = (byId[p.id]?.feedback || "").trim();
    if (!fb) return;
    setById(p.id, "busyRevise", true);
    try {
      const res = await apiFetch(`/api/prompts/${p.id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: fb }),
      });
      const data = (await res.json()) as {
        suggestion?: { template: string; system?: string | null };
        error?: string;
      };
      if (!data?.suggestion) {
        console.log("[prompts-manager] revise error", data?.error || "unknown");
        return;
      }
      setById(p.id, "suggestedTemplate", data.suggestion.template || "");
      setById(p.id, "suggestedSystem", data.suggestion.system || "");
      console.log("[prompts-manager] got suggestion for", p.id);
    } finally {
      setById(p.id, "busyRevise", false);
    }
  };

  const onAcceptSuggestion = async (p: Prompt, activate: boolean) => {
    const template = (byId[p.id]?.suggestedTemplate || "").trim();
    const system = (byId[p.id]?.suggestedSystem || "").trim();
    if (!template) return;
    setById(p.id, "busyRevise", true);
    try {
      const res = await apiFetch(`/api/prompts/${p.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          system: system || undefined,
          activate,
        }),
      });
      console.log("[prompts-manager] accept suggestion status", res.status);
      await refetch();
      setById(p.id, {
        ...byId[p.id],
        feedback: "",
        suggestedTemplate: "",
        suggestedSystem: "",
      });
    } finally {
      setById(p.id, "busyRevise", false);
    }
  };

  const view = (
    <Modal open={open()} onClose={close}>
      <div class="p-4 space-y-3">
        <div class="text-sm font-medium">Manage Prompts</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <div class="text-xs font-medium">Create new</div>
            <DesignerLaunch
              onCreated={() => {
                void refetch();
              }}
            />
            <input
              class="border rounded px-2 py-1 text-sm w-full"
              placeholder="task (unique)"
              value={newTask()}
              onInput={(e) => setNewTask((e.target as HTMLInputElement).value)}
            />
            <input
              class="border rounded px-2 py-1 text-sm w-full"
              placeholder="description"
              value={newDesc()}
              onInput={(e) => setNewDesc((e.target as HTMLInputElement).value)}
            />
            <textarea
              class="border rounded px-2 py-1 text-xs w-full h-28 font-mono"
              placeholder="template (Mustache)"
              value={newTemplate()}
              onInput={(e) =>
                setNewTemplate((e.target as HTMLTextAreaElement).value)
              }
            />
            <Show when={selectionMissing()}>
              <div class="text-[11px] text-amber-600 mt-1">
                Template is missing {"{{selection}}"}. It will be appended
                automatically when running, but you can insert it now.
                <div class="mt-1">
                  <button
                    class="rounded px-2 py-1 border text-[11px] hover:bg-gray-50"
                    onClick={onInsertSelectionVar}
                  >
                    Insert {"{{selection}}"}
                  </button>
                </div>
              </div>
            </Show>
            <textarea
              class="border rounded px-2 py-1 text-xs w-full h-16 font-mono"
              placeholder="system (optional)"
              value={newSystem()}
              onInput={(e) =>
                setNewSystem((e.target as HTMLTextAreaElement).value)
              }
            />
            <button
              class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50"
              onClick={onCreatePrompt}
            >
              Create & Activate
            </button>
          </div>
          <div class="space-y-2">
            <div class="text-xs font-medium">Existing</div>
            <Suspense
              fallback={<div class="text-xs text-gray-500">Loading…</div>}
            >
              <div class="space-y-3">
                <For each={prompts() || []}>
                  {(p) => (
                    <div class="border rounded p-2">
                      <div class="text-xs font-semibold">{p.task}</div>
                      <div class="text-xs text-gray-600">{p.description}</div>
                      <div class="mt-1 text-xs">
                        Active version:{" "}
                        <span class="font-mono">
                          {p.activeVersion?.id || "—"}
                        </span>
                      </div>
                      <Show when={p.activeVersion}>
                        {(av) => (
                          <details class="mt-1">
                            <summary class="text-xs cursor-pointer">
                              Active template
                            </summary>
                            <pre class="text-[11px] bg-gray-50 border rounded p-2 whitespace-pre-wrap">
                              {av().template}
                            </pre>
                          </details>
                        )}
                      </Show>
                      <div class="mt-2">
                        <button
                          class="rounded px-2 py-1 border text-xs hover:bg-gray-50"
                          onClick={() =>
                            onAddVersion(
                              p.id,
                              p.activeVersion?.template || "",
                              p.activeVersion?.system || undefined
                            )
                          }
                        >
                          Duplicate Active → New Version (Activate)
                        </button>
                      </div>
                      <Show when={p.activeVersion}>
                        {(av) => (
                          <details
                            class="mt-2"
                            onToggle={(e) => {
                              if ((e.target as HTMLDetailsElement).open)
                                initEditFor(p);
                            }}
                          >
                            <summary class="text-xs cursor-pointer">
                              Edit → New Version
                            </summary>
                            <div class="mt-2 space-y-2">
                              <div class="text-[11px] text-gray-600">
                                Template
                              </div>
                              <textarea
                                class="border rounded px-2 py-1 text-[11px] w-full h-32 font-mono"
                                value={
                                  byId[p.id]?.editTemplate ||
                                  av().template ||
                                  ""
                                }
                                onInput={(e) =>
                                  setById(
                                    p.id,
                                    "editTemplate",
                                    (e.target as HTMLTextAreaElement).value
                                  )
                                }
                              />
                              <div class="text-[11px] text-gray-600">
                                System (optional)
                              </div>
                              <textarea
                                class="border rounded px-2 py-1 text-[11px] w-full h-20 font-mono"
                                value={
                                  byId[p.id]?.editSystem || av().system || ""
                                }
                                onInput={(e) =>
                                  setById(
                                    p.id,
                                    "editSystem",
                                    (e.target as HTMLTextAreaElement).value
                                  )
                                }
                              />
                              <div class="flex gap-2">
                                <button
                                  class="rounded px-2 py-1 border text-[11px] hover:bg-gray-50 disabled:opacity-60"
                                  disabled={!!byId[p.id]?.busyEdit}
                                  onClick={() => onSaveNewVersion(p, false)}
                                >
                                  Save as New Version
                                </button>
                                <button
                                  class="rounded px-2 py-1 border text-[11px] hover:bg-gray-50 disabled:opacity-60"
                                  disabled={!!byId[p.id]?.busyEdit}
                                  onClick={() => onSaveNewVersion(p, true)}
                                >
                                  Save & Activate
                                </button>
                              </div>
                            </div>
                          </details>
                        )}
                      </Show>
                      <details class="mt-2">
                        <summary class="text-xs cursor-pointer">
                          Revise with Feedback (LLM)
                        </summary>
                        <div class="mt-2 space-y-2">
                          <textarea
                            class="border rounded px-2 py-1 text-[11px] w-full h-16"
                            placeholder="What should be improved?"
                            value={byId[p.id]?.feedback || ""}
                            onInput={(e) =>
                              setById(
                                p.id,
                                "feedback",
                                (e.target as HTMLTextAreaElement).value
                              )
                            }
                          />
                          <button
                            class="rounded px-2 py-1 border text-[11px] hover:bg-gray-50 disabled:opacity-60"
                            disabled={!!byId[p.id]?.busyRevise}
                            onClick={() => onRevise(p)}
                          >
                            Generate Suggestion
                          </button>
                          <Show
                            when={
                              (byId[p.id]?.suggestedTemplate || "").length > 0
                            }
                          >
                            <div class="mt-2 space-y-2">
                              <div class="text-[11px] text-gray-600">
                                Suggested Template
                              </div>
                              <textarea
                                class="border rounded px-2 py-1 text-[11px] w-full h-28 font-mono"
                                value={byId[p.id]?.suggestedTemplate || ""}
                                onInput={(e) =>
                                  setById(
                                    p.id,
                                    "suggestedTemplate",
                                    (e.target as HTMLTextAreaElement).value
                                  )
                                }
                              />
                              <div class="text-[11px] text-gray-600">
                                Suggested System (optional)
                              </div>
                              <textarea
                                class="border rounded px-2 py-1 text-[11px] w-full h-20 font-mono"
                                value={byId[p.id]?.suggestedSystem || ""}
                                onInput={(e) =>
                                  setById(
                                    p.id,
                                    "suggestedSystem",
                                    (e.target as HTMLTextAreaElement).value
                                  )
                                }
                              />
                              <div class="flex gap-2">
                                <button
                                  class="rounded px-2 py-1 border text-[11px] hover:bg-gray-50 disabled:opacity-60"
                                  disabled={!!byId[p.id]?.busyRevise}
                                  onClick={() => onAcceptSuggestion(p, false)}
                                >
                                  Accept → New Version
                                </button>
                                <button
                                  class="rounded px-2 py-1 border text-[11px] hover:bg-gray-50 disabled:opacity-60"
                                  disabled={!!byId[p.id]?.busyRevise}
                                  onClick={() => onAcceptSuggestion(p, true)}
                                >
                                  Accept → New Version & Activate
                                </button>
                              </div>
                            </div>
                          </Show>
                        </div>
                      </details>
                    </div>
                  )}
                </For>
              </div>
            </Suspense>
          </div>
        </div>
        <div class="flex justify-end">
          <button
            class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50"
            onClick={close}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );

  return { open: openModal, view };
}

function DesignerLaunch(props: { onCreated?: () => Promise<void> | void }) {
  const { open, view } = usePromptDesignerModal(props.onCreated);
  const handleOpen = () => {
    try {
      console.log("[prompts-manager] open Q&A designer");
    } catch {}
    open();
  };
  return (
    <div class="mb-2">
      <button
        class="rounded px-2 py-1 border text-[11px] hover:bg-gray-50"
        onClick={handleOpen}
      >
        New via Q&A (LLM)
      </button>
      {view}
    </div>
  );
}
