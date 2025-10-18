import { createResource, For, Show } from "solid-js";

// Normalize/sanitize AI HTML to mirror ReaderModal rendering
function cleanAiHtml(input: string): string {
  let s = (input || "").trim();
  const m = s.match(/<div[^>]*class=["']ai-html["'][^>]*>([\s\S]*?)<\/div>/i);
  if (m) s = m[1].trim();
  s = s.replace(/^```(?:html|md|markdown)?\s*/i, "");
  s = s.replace(/\s*```\s*$/i, "");
  s = s.replace(/```(?:html|md|markdown)?/gi, "").replace(/```/g, "");
  return s.trim();
}

async function fetchRuns() {
  const res = await fetch("/api/admin/runs?limit=100");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export default function AdminRuns() {
  const [data, { refetch }] = createResource(fetchRuns);

  async function submitFeedback(runId: string, e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    await fetch("/api/admin/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId,
        rating: Number(fd.get("rating")),
        comment: fd.get("comment"),
      }),
    });
    refetch();
  }

  async function removeFeedback(feedbackId: string) {
    await fetch(
      `/api/admin/runs?feedbackId=${encodeURIComponent(feedbackId)}`,
      {
        method: "DELETE",
      }
    );
    refetch();
  }

  async function clearFeedbackForRun(runId: string) {
    await fetch(`/api/admin/runs?runId=${encodeURIComponent(runId)}`, {
      method: "DELETE",
    });
    refetch();
  }

  return (
    <div class="p-6">
      <h2 class="text-xl font-semibold mb-4">Runs</h2>
      <Show when={data()}>
        <div class="space-y-4">
          <For each={data()!.runs}>
            {(r: any) => (
              <div class="border rounded p-4">
                <div class="text-sm text-gray-600">
                  {r.id} · {r.status} · {r.model}
                </div>
                <div class="text-sm">
                  Task: {r.promptVersion?.prompt?.task} · Version:{" "}
                  {r.promptVersionId}
                </div>
                <Show when={(r.HumanFeedback?.length ?? 0) > 0}>
                  <div class="mt-3 border-t pt-3">
                    <div class="flex items-center justify-between mb-2">
                      <div class="font-medium text-sm">Human Feedback</div>
                      <button
                        class="text-xs text-red-600 hover:underline"
                        onClick={[clearFeedbackForRun, r.id]}
                      >
                        Clear all
                      </button>
                    </div>
                    <ul class="space-y-2">
                      <For each={r.HumanFeedback}>
                        {(fb: any) => (
                          <li class="text-sm border rounded p-2">
                            <div class="flex items-center justify-between">
                              <div>
                                <span class="font-medium">Rating:</span>{" "}
                                {fb.rating ?? "-"}
                              </div>
                              <div class="flex items-center gap-3">
                                <div class="text-xs text-gray-500">
                                  {new Date(fb.createdAt).toLocaleString()}
                                </div>
                                <button
                                  class="text-xs text-red-600 hover:underline"
                                  onClick={[removeFeedback, fb.id]}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                            <Show when={fb.comment}>
                              <div class="mt-1 text-gray-700">{fb.comment}</div>
                            </Show>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                </Show>
                <details class="mt-2">
                  <summary class="cursor-pointer">Output</summary>
                  <div
                    class="ai-html mt-2"
                    innerHTML={cleanAiHtml(r.outputHtml || "")}
                  ></div>
                </details>
                <details class="mt-2">
                  <summary class="cursor-pointer">Compiled Prompt</summary>
                  <pre class="whitespace-pre-wrap text-xs bg-gray-50 p-2 border rounded mt-2">
                    {r.compiledPrompt}
                  </pre>
                </details>
                <details class="mt-2">
                  <summary class="cursor-pointer">Usage / Assertions</summary>
                  <pre class="whitespace-pre-wrap text-xs bg-gray-50 p-2 border rounded mt-2">
                    {JSON.stringify(r.usage ?? {}, null, 2)}
                  </pre>
                </details>
                <form
                  class="mt-3 flex gap-2 items-end"
                  onSubmit={[submitFeedback, r.id]}
                >
                  <label class="text-sm">
                    <div>Rating</div>
                    <input
                      name="rating"
                      type="number"
                      min="1"
                      max="5"
                      class="border rounded p-1 w-20"
                    />
                  </label>
                  <label class="text-sm flex-1">
                    <div>Comment</div>
                    <input name="comment" class="border rounded p-1 w-full" />
                  </label>
                  <button
                    type="submit"
                    class="bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    Save
                  </button>
                </form>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
