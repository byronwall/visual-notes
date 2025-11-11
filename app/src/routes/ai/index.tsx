import {
  type VoidComponent,
  For,
  Show,
  Suspense,
  createMemo,
  createResource,
  createSignal,
} from "solid-js";
import { A } from "@solidjs/router";
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

type RunStatus = "SUCCESS" | "ERROR" | "PARTIAL";
type PromptRunItem = {
  id: string;
  status: RunStatus;
  model: string;
  createdAt: string;
  error?: string | null;
  promptVersionId: string;
  compiledPrompt: string;
  systemUsed?: string | null;
  outputHtml?: string | null;
  rawResponse?: unknown | null;
  inputVars?: Record<string, unknown> | null;
  promptId?: string | null;
  promptTask?: string | null;
  versionId?: string | null;
};
type RunsResponse = { items: PromptRunItem[] };

async function fetchPrompts(): Promise<Prompt[]> {
  const res = await apiFetch("/api/prompts");
  const data = (await res.json()) as PromptsResponse;
  console.log("[ai-dashboard] prompts loaded", data.items?.length || 0);
  return data.items || [];
}

async function fetchRuns(): Promise<PromptRunItem[]> {
  const res = await apiFetch("/api/ai/runs?limit=100");
  const data = (await res.json()) as RunsResponse;
  console.log("[ai-dashboard] runs loaded", data.items?.length || 0);
  return data.items || [];
}

const AiDashboard: VoidComponent = () => {
  const [prompts] = createResource(fetchPrompts);
  const [runs] = createResource(fetchRuns);

  const [statusFilter, setStatusFilter] = createSignal<"ALL" | RunStatus>("ALL");
  const [query, setQuery] = createSignal("");

  const filteredRuns = createMemo(() => {
    const items = runs() || [];
    const q = query().trim().toLowerCase();
    const status = statusFilter();
    return items.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (!q) return true;
      const hay =
        `${r.id} ${r.promptTask || ""} ${r.model} ${r.error || ""}`.toLowerCase();
      return hay.includes(q);
    });
  });

  const metrics = createMemo(() => {
    const ps = prompts() || [];
    const rs = runs() || [];
    const total = rs.length;
    const success = rs.filter((r) => r.status === "SUCCESS").length;
    const error = rs.filter((r) => r.status === "ERROR").length;
    const partial = rs.filter((r) => r.status === "PARTIAL").length;
    const byModel = new Map<string, number>();
    for (const r of rs) {
      byModel.set(r.model, (byModel.get(r.model) || 0) + 1);
    }
    let topModel = "";
    let topCount = 0;
    for (const [m, c] of byModel.entries()) {
      if (c > topCount) {
        topModel = m;
        topCount = c;
      }
    }
    return {
      promptCount: ps.length,
      runCount: total,
      success,
      error,
      partial,
      successRate: total ? Math.round((success / total) * 100) : 0,
      topModel,
      topModelCount: topCount,
    };
  });

  const promptIdToRunCount = createMemo(() => {
    const map = new Map<string, number>();
    for (const r of runs() || []) {
      const pid = r.promptId || "";
      if (!pid) continue;
      map.set(pid, (map.get(pid) || 0) + 1);
    }
    return map;
  });

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4 space-y-6">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">AI Dashboard</h1>
          <div class="flex items-center gap-2">
            <input
              class="border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="Search runs by id, task, model…"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
            <select
              class="border border-gray-300 rounded px-2 py-1 text-sm"
              value={statusFilter()}
              onChange={(e) => setStatusFilter(e.currentTarget.value as any)}
            >
              <option value="ALL">All</option>
              <option value="SUCCESS">Success</option>
              <option value="ERROR">Error</option>
              <option value="PARTIAL">Partial</option>
            </select>
          </div>
        </div>

        <Suspense fallback={<div class="text-sm text-gray-500">Loading…</div>}>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="rounded border p-3">
              <div class="text-xs text-gray-600">Prompts</div>
              <div class="text-2xl font-semibold">{metrics().promptCount}</div>
            </div>
            <div class="rounded border p-3">
              <div class="text-xs text-gray-600">Runs (recent)</div>
              <div class="text-2xl font-semibold">{metrics().runCount}</div>
            </div>
            <div class="rounded border p-3">
              <div class="text-xs text-gray-600">Success rate</div>
              <div class="text-2xl font-semibold">
                {metrics().successRate}%
              </div>
            </div>
            <div class="rounded border p-3">
              <div class="text-xs text-gray-600">Top model</div>
              <div class="text-sm font-semibold">
                <Show when={metrics().topModel} fallback={<span>—</span>}>
                  {(m) => (
                    <span>
                      {m()}{" "}
                      <span class="text-gray-500">
                        ({metrics().topModelCount})
                      </span>
                    </span>
                  )}
                </Show>
              </div>
            </div>
          </div>
        </Suspense>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">Prompts</h2>
            </div>
            <div class="overflow-hidden rounded border border-gray-200">
              <Suspense fallback={<div class="p-3 text-sm">Loading…</div>}>
                <table class="w-full text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="text-left p-2">Task</th>
                      <th class="text-left p-2">Active Version</th>
                      <th class="text-left p-2">Default</th>
                      <th class="text-right p-2">Runs</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={prompts() || []}>
                      {(p) => (
                        <tr class="border-t border-gray-200 hover:bg-gray-50 align-top">
                          <td class="p-2">
                            <div class="font-medium">
                              <A
                                href={`/ai/prompts/${p.id}`}
                                class="hover:underline"
                              >
                                {p.task}
                              </A>
                            </div>
                            <div class="text-[12px] text-gray-600">
                              {p.description || "—"}
                            </div>
                          </td>
                          <td class="p-2">
                            <div class="font-mono text-[12px]">
                              {p.activeVersion?.id || "—"}
                            </div>
                            <Show when={p.activeVersion}>
                              {(av) => (
                                <details class="mt-1">
                                  <summary class="text-xs cursor-pointer">
                                    Template
                                  </summary>
                                  <pre class="text-[11px] bg-gray-50 border rounded p-2 whitespace-pre-wrap">
{av().template}
                                  </pre>
                                </details>
                              )}
                            </Show>
                          </td>
                          <td class="p-2">
                            <div>{p.defaultModel}</div>
                            <div class="text-[12px] text-gray-600">
                              temp {p.defaultTemp}
                              <Show when={typeof p.defaultTopP === "number"}>
                                {(v) => <span> · top_p {String(v())}</span>}
                              </Show>
                            </div>
                          </td>
                          <td class="p-2 text-right">
                            {promptIdToRunCount().get(p.id) || 0}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Suspense>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">Recent Runs</h2>
            </div>
            <div class="overflow-hidden rounded border border-gray-200">
              <Suspense fallback={<div class="p-3 text-sm">Loading…</div>}>
                <table class="w-full text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="text-left p-2">Run</th>
                      <th class="text-left p-2">Task</th>
                      <th class="text-left p-2">Model</th>
                      <th class="text-left p-2">Status</th>
                      <th class="text-left p-2">Created</th>
                      <th class="text-right p-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={filteredRuns()}>
                      {(r) => (
                        <tr class="border-t border-gray-200 hover:bg-gray-50 align-top">
                          <td class="p-2 font-mono">
                            <A
                              href={`/ai/runs/${r.id}`}
                              class="hover:underline"
                            >
                              {r.id.slice(0, 8)}
                            </A>
                          </td>
                          <td class="p-2">{r.promptTask || "—"}</td>
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
                              class="text-blue-600 hover:underline mr-3"
                            >
                              Open
                            </A>
                            <details>
                              <summary class="cursor-pointer text-blue-600">
                                View
                              </summary>
                              <div class="mt-2 space-y-2">
                                <div>
                                  <div class="text-xs text-gray-600">
                                    Compiled Prompt
                                  </div>
                                  <pre class="text-[11px] bg-gray-50 border rounded p-2 whitespace-pre-wrap">
{r.compiledPrompt}
                                  </pre>
                                </div>
                                <Show when={r.systemUsed}>
                                  {(s) => (
                                    <div>
                                      <div class="text-xs text-gray-600">
                                        System
                                      </div>
                                      <pre class="text-[11px] bg-gray-50 border rounded p-2 whitespace-pre-wrap">
{s()}
                                      </pre>
                                    </div>
                                  )}
                                </Show>
                                <div>
                                  <div class="text-xs text-gray-600">
                                    Output (HTML)
                                  </div>
                                  <div class="text-[11px] bg-gray-50 border rounded p-2 whitespace-pre-wrap">
                                    <Show
                                      when={r.outputHtml}
                                      fallback={<span>—</span>}
                                    >
                                      {(h) => <div innerHTML={h()} />}
                                    </Show>
                                  </div>
                                </div>
                                <Show when={r.error}>
                                  {(e) => (
                                    <div class="text-xs text-red-700">
                                      Error: {e()}
                                    </div>
                                  )}
                                </Show>
                              </div>
                            </details>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AiDashboard;


