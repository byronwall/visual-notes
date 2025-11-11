import {
  type VoidComponent,
  Show,
  Suspense,
  createResource,
} from "solid-js";
import { useParams, A } from "@solidjs/router";
import { apiFetch } from "~/utils/base-url";

type RunStatus = "SUCCESS" | "ERROR" | "PARTIAL";

type PromptRunFull = {
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
  promptVersion?: {
    id: string;
    promptId: string;
    Prompt?: { id: string; task: string; defaultModel: string } | null;
  } | null;
  HumanFeedback?: Array<{
    id: string;
    rating?: number | null;
    comment?: string | null;
    createdAt: string;
  }>;
};

async function fetchRun(id: string): Promise<PromptRunFull> {
  const res = await apiFetch(`/api/ai/runs/${id}`);
  const data = (await res.json()) as { item: PromptRunFull };
  console.log("[ai-run] loaded", id);
  return data.item;
}

const RunDetailPage: VoidComponent = () => {
  const params = useParams();
  const [run] = createResource(() => params.id, fetchRun);

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4 space-y-6">
        <div>
          <A href="/ai" class="text-sm text-blue-600 hover:underline">
            ← Back to AI Dashboard
          </A>
        </div>
        <Suspense fallback={<div class="text-sm text-gray-500">Loading…</div>}>
          <Show when={run()}>
            {(r) => (
              <div class="space-y-6">
                <div class="flex items-center justify-between">
                  <div>
                    <h1 class="text-2xl font-bold">
                      Run {r().id.slice(0, 8)}
                    </h1>
                    <div class="text-sm text-gray-600">
                      {new Date(r().createdAt).toLocaleString()} ·{" "}
                      <span>{r().model}</span> ·{" "}
                      <span
                        class={
                          r().status === "SUCCESS"
                            ? "text-green-700"
                            : r().status === "ERROR"
                            ? "text-red-700"
                            : "text-yellow-700"
                        }
                      >
                        {r().status}
                      </span>
                    </div>
                  </div>
                  <Show when={r().promptVersion?.Prompt}>
                    {(p) => (
                      <A
                        href={`/ai/prompts/${p().id}`}
                        class="text-sm text-blue-600 hover:underline"
                      >
                        View Prompt: {p().task}
                      </A>
                    )}
                  </Show>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div class="space-y-4">
                    <div class="rounded border p-3">
                      <div class="text-xs text-gray-600">Compiled Prompt</div>
                      <pre class="text-[11px] bg-gray-50 border rounded p-2 whitespace-pre-wrap">
{r().compiledPrompt}
                      </pre>
                    </div>
                    <Show when={r().systemUsed}>
                      {(s) => (
                        <div class="rounded border p-3">
                          <div class="text-xs text-gray-600">System</div>
                          <pre class="text-[11px] bg-gray-50 border rounded p-2 whitespace-pre-wrap">
{s()}
                          </pre>
                        </div>
                      )}
                    </Show>
                    <div class="rounded border p-3">
                      <div class="text-xs text-gray-600">Input Vars</div>
                      <pre class="text-[11px] bg-gray-50 border rounded p-2 whitespace-pre-wrap">
{JSON.stringify(r().inputVars ?? {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <div class="space-y-4">
                    <div class="rounded border p-3">
                      <div class="text-xs text-gray-600">Output (HTML)</div>
                      <div class="text-[11px] bg-gray-50 border rounded p-2 whitespace-pre-wrap">
                        <Show when={r().outputHtml} fallback={<span>—</span>}>
                          {(h) => <div innerHTML={h()} />}
                        </Show>
                      </div>
                    </div>
                    <div class="rounded border p-3">
                      <div class="text-xs text-gray-600">Raw Response</div>
                      <pre class="text-[11px] bg-gray-50 border rounded p-2 whitespace-pre-wrap">
{JSON.stringify(r().rawResponse ?? {}, null, 2)}
                      </pre>
                    </div>
                    <Show when={r().error}>
                      {(e) => (
                        <div class="rounded border p-3 text-sm text-red-700">
                          Error: {e()}
                        </div>
                      )}
                    </Show>
                  </div>
                </div>

                <Show when={Array.isArray(run()?.HumanFeedback) && run()!.HumanFeedback!.length > 0}>
                  <div class="rounded border p-3">
                    <div class="text-sm font-semibold mb-2">Human Feedback</div>
                    <ul class="space-y-2 text-sm">
                      {run()!.HumanFeedback!.map((f) => (
                        <li class="border rounded p-2">
                          <div>
                            <span class="text-gray-600">Rating:</span>{" "}
                            {typeof f.rating === "number" ? f.rating : "—"}
                          </div>
                          <div>
                            <span class="text-gray-600">Comment:</span>{" "}
                            {f.comment || "—"}
                          </div>
                          <div class="text-gray-600">
                            {new Date(f.createdAt).toLocaleString()}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Show>
              </div>
            )}
          </Show>
        </Suspense>
      </div>
    </main>
  );
};

export default RunDetailPage;


