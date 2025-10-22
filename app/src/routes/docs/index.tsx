import { type VoidComponent, For, Show, createResource } from "solid-js";
import { A } from "@solidjs/router";
import { apiFetch } from "~/utils/base-url";

type DocListItem = { id: string; title: string; createdAt: string };

async function fetchDocs() {
  const res = await apiFetch("/api/docs");
  if (!res.ok) throw new Error("Failed to load notes");
  const json = (await res.json()) as { items: DocListItem[] };
  return json.items;
}

async function deleteAllDocs() {
  const res = await apiFetch("/api/docs", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete all notes");
}

async function bulkSetSource() {
  const value = prompt("Enter source to set on all notes (originalSource):");
  if (!value) return;
  const res = await apiFetch("/api/docs/source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ originalSource: value }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to set source on notes");
  }
}

const DocsIndex: VoidComponent = () => {
  const [docs, { refetch }] = createResource(fetchDocs);

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">Notes</h1>
          <div class="flex items-center gap-2">
            <button
              class="px-3 py-1.5 rounded bg-gray-700 text-white text-sm hover:bg-gray-800 disabled:opacity-50"
              onClick={async () => {
                try {
                  await bulkSetSource();
                  await refetch();
                } catch (e) {
                  console.error(e);
                  alert((e as Error).message || "Failed to set source");
                }
              }}
            >
              Set Source (All)
            </button>
            <button
              class="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
              onClick={async () => {
                if (!confirm("Delete ALL notes? This cannot be undone."))
                  return;
                try {
                  await deleteAllDocs();
                  await refetch();
                } catch (e) {
                  console.error(e);
                  alert("Failed to delete all notes");
                }
              }}
            >
              Delete All
            </button>
          </div>
        </div>
        <Show when={docs()} fallback={<p>Loading…</p>}>
          {(items) => (
            <ul class="space-y-2">
              <For each={items()}>
                {(d) => (
                  <li class="flex items-center justify-between border border-gray-200 rounded p-3 hover:bg-gray-50">
                    <A
                      href={`/docs/${d.id}`}
                      class="font-medium hover:underline"
                    >
                      {d.title}
                    </A>
                    <span class="text-gray-500 text-sm">
                      {new Date(d.createdAt).toLocaleString()}
                    </span>
                  </li>
                )}
              </For>
            </ul>
          )}
        </Show>
      </div>
    </main>
  );
};

export default DocsIndex;
