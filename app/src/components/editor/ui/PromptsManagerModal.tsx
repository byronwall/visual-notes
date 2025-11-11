import { For, Show, Suspense, createResource, createSignal } from "solid-js";
import Modal from "../../Modal";
import { apiFetch } from "~/utils/base-url";

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

  const view = (
    <Modal open={open()} onClose={close}>
      <div class="p-4 space-y-3">
        <div class="text-sm font-medium">Manage Prompts</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <div class="text-xs font-medium">Create new</div>
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
