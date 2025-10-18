import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";

async function fetchRequests(params: {
  status?: string;
  model?: string;
  limit?: number;
}) {
  const url = new URL("/api/admin/llm-requests", window.location.origin);
  if (params.status) url.searchParams.set("status", params.status);
  if (params.model) url.searchParams.set("model", params.model);
  url.searchParams.set("limit", String(params.limit ?? 100));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export default function AdminLlmRequests() {
  const [status, setStatus] = createSignal<string>("");
  const [model, setModel] = createSignal<string>("");
  const params = createMemo(() => ({
    status: status() || undefined,
    model: model() || undefined,
    limit: 100,
  }));
  const [data, { refetch }] = createResource(params, fetchRequests);

  createEffect(() => {
    // refetch when filters change
    params();
    refetch();
  });

  return (
    <div class="p-6 space-y-4">
      <h2 class="text-xl font-semibold">All LLM requests</h2>
      <div class="flex gap-3 items-end">
        <label class="text-sm">
          <div>Status</div>
          <select
            class="border rounded p-1"
            value={status()}
            onInput={(e) => setStatus((e.target as HTMLSelectElement).value)}
          >
            <option value="">Any</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="ERROR">ERROR</option>
            <option value="PARTIAL">PARTIAL</option>
          </select>
        </label>
        <label class="text-sm">
          <div>Model</div>
          <input
            class="border rounded p-1"
            value={model()}
            onInput={(e) => setModel((e.target as HTMLInputElement).value)}
            placeholder="contains..."
          />
        </label>
        <button
          class="bg-blue-600 text-white px-3 py-1 rounded"
          onClick={() => refetch()}
        >
          Refresh
        </button>
      </div>

      <Show when={data()}>
        <div class="space-y-3">
          <For each={data()!.requests}>
            {(r: any) => (
              <div class="border rounded p-4">
                <div class="text-sm text-gray-600">
                  {r.id} · {r.status} · {r.model}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2 text-sm">
                  <div>
                    <div class="font-medium">Inputs</div>
                    <div>
                      Temp: {r.temperature ?? "-"} · TopP: {r.topP ?? "-"}
                    </div>
                    <details class="mt-1">
                      <summary class="cursor-pointer">System</summary>
                      <pre class="whitespace-pre-wrap text-xs bg-gray-50 p-2 border rounded mt-2">
                        {r.system || ""}
                      </pre>
                    </details>
                    <details class="mt-1">
                      <summary class="cursor-pointer">User</summary>
                      <pre class="whitespace-pre-wrap text-xs bg-gray-50 p-2 border rounded mt-2">
                        {r.userPrompt || ""}
                      </pre>
                    </details>
                  </div>
                  <div>
                    <div class="font-medium">Outputs</div>
                    <div>Prompt tokens: {r.promptTokens ?? "-"}</div>
                    <div>Completion tokens: {r.completionTokens ?? "-"}</div>
                    <div>Total tokens: {r.totalTokens ?? "-"}</div>
                    <Show when={r.error}>
                      <div class="text-red-700 mt-1">Error: {r.error}</div>
                    </Show>
                  </div>
                  <div>
                    <details>
                      <summary class="cursor-pointer">Output text</summary>
                      <pre class="whitespace-pre-wrap text-xs bg-gray-50 p-2 border rounded mt-2">
                        {r.outputText || ""}
                      </pre>
                    </details>
                    <details class="mt-2">
                      <summary class="cursor-pointer">Raw response</summary>
                      <pre class="whitespace-pre-wrap text-xs bg-gray-50 p-2 border rounded mt-2">
                        {JSON.stringify(r.rawResponse ?? {}, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
                <div class="text-xs text-gray-500 mt-2">
                  {new Date(r.createdAt).toLocaleString()}
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
