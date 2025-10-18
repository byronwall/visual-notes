import { createResource, For, Show } from "solid-js";

async function fetchPrompts() {
  const res = await fetch("/api/admin/prompts");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export default function AdminPrompts() {
  const [data, { refetch }] = createResource(fetchPrompts);

  async function saveDefaults(p: any, e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const payload = {
      id: p.id,
      defaultModel: fd.get("defaultModel"),
      defaultTemp: Number(fd.get("defaultTemp")),
      defaultTopP: fd.get("defaultTopP") ? Number(fd.get("defaultTopP")) : null,
    };
    await fetch("/api/admin/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    refetch();
  }

  async function createVersion(task: string, e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const payload = {
      task,
      template: fd.get("template"),
      system: fd.get("system") || null,
      modelOverride: fd.get("modelOverride") || null,
      tempOverride: fd.get("tempOverride")
        ? Number(fd.get("tempOverride"))
        : null,
      topPOverride: fd.get("topPOverride")
        ? Number(fd.get("topPOverride"))
        : null,
    };
    await fetch("/api/admin/versions/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    refetch();
  }

  async function generateFromFeedback(task: string, e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const payload: any = {
      action: "generate_from_feedback",
      task,
      model: fd.get("model") || null,
    };
    const minRating = fd.get("minRating");
    const lookbackDays = fd.get("lookbackDays");
    const limit = fd.get("limit");
    if (minRating) payload.minRating = Number(minRating);
    if (lookbackDays) payload.lookbackDays = Number(lookbackDays);
    if (limit) payload.limit = Number(limit);
    const res = await fetch("/api/admin/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      alert("Generated a new version from human feedback");
      refetch();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(`Error: ${j.error || res.status}`);
    }
  }

  async function activate(promptId: string, versionId: string) {
    await fetch("/api/admin/versions/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptId, versionId }),
    });
    refetch();
  }

  return (
    <div class="p-6">
      <h2 class="text-xl font-semibold mb-4">Prompts</h2>
      <Show when={data()}>
        <For each={data()!.prompts}>
          {(p: any) => (
            <div class="border rounded p-4 mb-6">
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium">{p.task}</div>
                  <div class="text-sm text-gray-500">
                    Active: {p.activeVersion?.id}
                  </div>
                </div>
              </div>
              <Show when={p.activeVersion}>
                <details class="mt-3 border rounded p-3 bg-gray-50">
                  <summary class="cursor-pointer font-medium">
                    Active Version Details
                  </summary>
                  <div class="mt-2 text-xs text-gray-600">
                    Version ID: {p.activeVersion.id}
                  </div>
                  <Show
                    when={
                      p.activeVersion.metadata?.source ||
                      p.activeVersion.metadata?.synthesisNotes
                    }
                  >
                    <div class="mt-2 text-xs">
                      <div>
                        <span class="font-semibold">Source:</span>{" "}
                        {p.activeVersion.metadata?.source || "-"}
                      </div>
                      <Show when={p.activeVersion.metadata?.synthesisNotes}>
                        <div class="mt-1">
                          <div class="font-semibold">Notes</div>
                          <pre class="whitespace-pre-wrap text-xs bg-white p-2 border rounded">
                            {p.activeVersion.metadata?.synthesisNotes}
                          </pre>
                        </div>
                      </Show>
                    </div>
                  </Show>
                  <div class="mt-3">
                    <div class="font-semibold text-sm">Template</div>
                    <pre class="whitespace-pre-wrap text-xs bg-white p-2 border rounded mt-1">
                      {p.activeVersion.template}
                    </pre>
                  </div>
                  <Show when={p.activeVersion.system}>
                    <div class="mt-3">
                      <div class="font-semibold text-sm">System</div>
                      <pre class="whitespace-pre-wrap text-xs bg-white p-2 border rounded mt-1">
                        {p.activeVersion.system}
                      </pre>
                    </div>
                  </Show>
                </details>
              </Show>
              <form
                class="mt-3 space-x-2 inline-flex items-end"
                onSubmit={[saveDefaults, p]}
              >
                <label class="text-sm">
                  <div>Default Model</div>
                  <input
                    name="defaultModel"
                    class="border p-1 rounded"
                    value={p.defaultModel}
                  />
                </label>
                <label class="text-sm">
                  <div>Default Temp</div>
                  <input
                    name="defaultTemp"
                    type="number"
                    step="0.01"
                    class="border p-1 rounded"
                    value={p.defaultTemp}
                  />
                </label>
                <label class="text-sm">
                  <div>Default TopP</div>
                  <input
                    name="defaultTopP"
                    type="number"
                    step="0.01"
                    class="border p-1 rounded"
                    value={p.defaultTopP ?? ""}
                  />
                </label>
                <button
                  type="submit"
                  class="bg-blue-600 text-white px-3 py-1 rounded"
                >
                  Save
                </button>
              </form>

              <div class="mt-4">
                <div class="font-medium mb-1">Generate From Human Feedback</div>
                <form
                  class="grid grid-cols-1 md:grid-cols-4 gap-2"
                  onSubmit={[generateFromFeedback, p.task]}
                >
                  <input
                    name="minRating"
                    type="number"
                    min="1"
                    max="5"
                    class="border rounded p-2"
                    placeholder="Min rating (e.g., 4)"
                  />
                  <input
                    name="lookbackDays"
                    type="number"
                    min="1"
                    class="border rounded p-2"
                    placeholder="Lookback days (e.g., 30)"
                  />
                  <input
                    name="limit"
                    type="number"
                    min="10"
                    class="border rounded p-2"
                    placeholder="Max feedback to use (e.g., 100)"
                  />
                  <input
                    name="model"
                    class="border rounded p-2"
                    placeholder="Model (optional)"
                  />
                  <div class="md:col-span-4">
                    <button
                      type="submit"
                      class="bg-purple-600 text-white px-3 py-1 rounded"
                    >
                      Generate
                    </button>
                  </div>
                </form>
              </div>

              <div class="mt-4">
                <div class="font-medium mb-1">Create Version</div>
                <form
                  class="grid grid-cols-1 gap-2"
                  onSubmit={[createVersion, p.task]}
                >
                  <textarea
                    name="template"
                    class="border rounded p-2 h-28"
                    placeholder="Template with {{book}} {{chapter}} {{passageHtml}}"
                  />
                  <input
                    name="system"
                    class="border rounded p-2"
                    placeholder="System prompt (optional)"
                  />
                  <div class="grid grid-cols-3 gap-2">
                    <input
                      name="modelOverride"
                      class="border rounded p-2"
                      placeholder="modelOverride"
                    />
                    <input
                      name="tempOverride"
                      type="number"
                      step="0.01"
                      class="border rounded p-2"
                      placeholder="tempOverride"
                    />
                    <input
                      name="topPOverride"
                      type="number"
                      step="0.01"
                      class="border rounded p-2"
                      placeholder="topPOverride"
                    />
                  </div>
                  <button
                    type="submit"
                    class="bg-green-600 text-white px-3 py-1 rounded"
                  >
                    Create
                  </button>
                </form>
              </div>

              <div class="mt-4">
                <div class="font-medium mb-1">Recent Versions</div>
                <ul class="space-y-1">
                  <For each={p.versions}>
                    {(v: any) => (
                      <li class="border p-2 rounded">
                        <div class="flex items-center justify-between">
                          <code class="text-xs">{v.id}</code>
                          <div class="space-x-2">
                            <button
                              class="px-2 py-1 text-sm bg-indigo-600 text-white rounded"
                              onClick={() => activate(p.id, v.id)}
                            >
                              Activate
                            </button>
                          </div>
                        </div>
                        <Show
                          when={
                            v.metadata?.source || v.metadata?.synthesisNotes
                          }
                        >
                          <div class="mt-2 text-xs text-gray-600">
                            <div>
                              <span class="font-semibold">Source:</span>{" "}
                              {v.metadata?.source || "-"}
                            </div>
                            <Show when={v.metadata?.synthesisNotes}>
                              <div class="mt-1">
                                <div class="font-semibold">Notes</div>
                                <pre class="whitespace-pre-wrap text-xs bg-gray-50 p-2 border rounded">
                                  {v.metadata?.synthesisNotes}
                                </pre>
                              </div>
                            </Show>
                          </div>
                        </Show>
                        <details class="mt-2">
                          <summary class="cursor-pointer text-sm">
                            View Template/System
                          </summary>
                          <div class="mt-2">
                            <div class="font-semibold text-sm">Template</div>
                            <pre class="whitespace-pre-wrap text-xs bg-gray-50 p-2 border rounded mt-1">
                              {v.template}
                            </pre>
                          </div>
                          <Show when={v.system}>
                            <div class="mt-3">
                              <div class="font-semibold text-sm">System</div>
                              <pre class="whitespace-pre-wrap text-xs bg-gray-50 p-2 border rounded mt-1">
                                {v.system}
                              </pre>
                            </div>
                          </Show>
                        </details>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
