import {
  type VoidComponent,
  For,
  Show,
  Suspense,
  createResource,
} from "solid-js";
import { useParams, A } from "@solidjs/router";
import { apiFetch } from "~/utils/base-url";

type PromptVersion = {
  id: string;
  template: string;
  system?: string | null;
  modelOverride?: string | null;
  tempOverride?: number | null;
  topPOverride?: number | null;
  createdAt: string;
};

type PromptFull = {
  id: string;
  task: string;
  description?: string | null;
  defaultModel: string;
  defaultTemp: number;
  defaultTopP?: number | null;
  activeVersion?: PromptVersion | null;
  versions: PromptVersion[];
};

async function fetchPrompt(id: string): Promise<PromptFull> {
  const res = await apiFetch(`/api/prompts/${id}`);
  const data = (await res.json()) as { item: PromptFull };
  console.log("[ai-prompt] loaded", id);
  return data.item;
}

async function fetchRunsForPrompt(promptId: string) {
  const res = await apiFetch(`/api/ai/runs?promptId=${encodeURIComponent(promptId)}`);
  const json = (await res.json()) as {
    items: Array<{
      id: string;
      model: string;
      status: "SUCCESS" | "ERROR" | "PARTIAL";
      createdAt: string;
      versionId?: string | null;
    }>;
  };
  return json.items || [];
}

const PromptDetailPage: VoidComponent = () => {
  const params = useParams();
  const [prompt] = createResource(() => params.id, fetchPrompt);
  const [runs] = createResource(() => params.id, fetchRunsForPrompt);

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4 space-y-6">
        <div>
          <A href="/ai" class="text-sm text-blue-600 hover:underline">
            ← Back to AI Dashboard
          </A>
        </div>

        <Suspense fallback={<div class="text-sm text-gray-500">Loading…</div>}>
          <Show when={prompt()}>
            {(p) => (
              <div class="space-y-6">
                <div class="flex items-center justify-between">
                  <div>
                    <h1 class="text-2xl font-bold">{p().task}</h1>
                    <div class="text-sm text-gray-600">
                      {p().description || "—"}
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div class="lg:col-span-2 space-y-4">
                    <div class="rounded border p-3">
                      <div class="text-xs text-gray-600">Defaults</div>
                      <div class="text-sm">
                        Model: <span class="font-medium">{p().defaultModel}</span>
                      </div>
                      <div class="text-sm">
                        Temp: <span class="font-medium">{p().defaultTemp}</span>{" "}
                        <Show when={typeof p().defaultTopP === "number"}>
                          {(v) => (
                            <span>
                              · TopP: <span class="font-medium">{String(v())}</span>
                            </span>
                          )}
                        </Show>
                      </div>
                    </div>

                    <div class="rounded border p-3">
                      <div class="text-sm font-semibold mb-2">Active Version</div>
                      <Show when={p().activeVersion} fallback={<div class="text-sm">—</div>}>
                        {(av) => (
                          <div class="space-y-2">
                            <div class="text-sm font-mono">{av().id}</div>
                            <div class="text-xs text-gray-600">
                              Overrides:{" "}
                              {av().modelOverride || av().tempOverride || av().topPOverride
                                ? `${av().modelOverride || "model—"} · temp ${typeof av().tempOverride === "number" ? av().tempOverride : "—"} · top_p ${typeof av().topPOverride === "number" ? av().topPOverride : "—"}`
                                : "none"}
                            </div>
                            <details>
                              <summary class="text-xs cursor-pointer">Template</summary>
                              <pre class="text-[11px] bg-gray-50 border rounded p-2 whitespace-pre-wrap">
{av().template}
                              </pre>
                            </details>
                            <Show when={av().system}>
                              {(s) => (
                                <details>
                                  <summary class="text-xs cursor-pointer">System</summary>
                                  <pre class="text-[11px] bg-gray-50 border rounded p-2 whitespace-pre-wrap">
{s()}
                                  </pre>
                                </details>
                              )}
                            </Show>
                          </div>
                        )}
                      </Show>
                    </div>

                    <div class="rounded border p-3">
                      <div class="text-sm font-semibold mb-2">All Versions</div>
                      <div class="space-y-3">
                        <For each={p().versions}>
                          {(v) => (
                            <div class="border rounded p-2">
                              <div class="flex items-center justify-between">
                                <div>
                                  <div class="text-sm font-mono">{v.id}</div>
                                  <div class="text-[12px] text-gray-600">
                                    {new Date(v.createdAt).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div class="mt-2 text-xs text-gray-700">
                                Overrides:{" "}
                                {v.modelOverride || v.tempOverride || v.topPOverride
                                  ? `${v.modelOverride || "model—"} · temp ${typeof v.tempOverride === "number" ? v.tempOverride : "—"} · top_p ${typeof v.topPOverride === "number" ? v.topPOverride : "—"}`
                                  : "none"}
                              </div>
                              <details class="mt-2">
                                <summary class="text-xs cursor-pointer">Template</summary>
                                <pre class="text-[11px] bg-gray-50 border rounded p-2 whitespace-pre-wrap">
{v.template}
                                </pre>
                              </details>
                              <Show when={v.system}>
                                {(s) => (
                                  <details class="mt-2">
                                    <summary class="text-xs cursor-pointer">System</summary>
                                    <pre class="text-[11px] bg-gray-50 border rounded p-2 whitespace-pre-wrap">
{s()}
                                    </pre>
                                  </details>
                                )}
                              </Show>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                  <div class="space-y-3">
                    <div class="text-sm font-semibold">Recent Runs</div>
                    <Suspense fallback={<div class="text-sm text-gray-500">Loading runs…</div>}>
                      <div class="overflow-hidden rounded border border-gray-200">
                        <table class="w-full text-sm">
                          <thead class="bg-gray-50">
                            <tr>
                              <th class="text-left p-2">Run</th>
                              <th class="text-left p-2">Model</th>
                              <th class="text-left p-2">Status</th>
                              <th class="text-left p-2">Created</th>
                              <th class="text-right p-2">View</th>
                            </tr>
                          </thead>
                          <tbody>
                            <For each={runs() || []}>
                              {(r) => (
                                <tr class="border-t border-gray-200 hover:bg-gray-50">
                                  <td class="p-2 font-mono">{r.id.slice(0, 8)}</td>
                                  <td class="p-2">{r.model}</td>
                                  <td class="p-2">
                                    <span
                                      class={
                                        r.status === "SUCCESS"
                                          ? "text-green-700"
                                          : r.status === "ERROR"
                                          ? "text-red-700"
                                          : "text-yellow-700"
                                      }
                                    >
                                      {r.status}
                                    </span>
                                  </td>
                                  <td class="p-2">
                                    {new Date(r.createdAt).toLocaleString()}
                                  </td>
                                  <td class="p-2 text-right">
                                    <A
                                      href={`/ai/runs/${r.id}`}
                                      class="text-blue-600 hover:underline"
                                    >
                                      View
                                    </A>
                                  </td>
                                </tr>
                              )}
                            </For>
                          </tbody>
                        </table>
                      </div>
                    </Suspense>
                  </div>
                </div>
              </div>
            )}
          </Show>
        </Suspense>
      </div>
    </main>
  );
};

export default PromptDetailPage;


