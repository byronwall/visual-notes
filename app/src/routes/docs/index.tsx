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

const DocsIndex: VoidComponent = () => {
  const [docs, { refetch }] = createResource(fetchDocs);

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">Notes</h1>
          <button
            class="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
            onClick={async () => {
              if (!confirm("Delete ALL notes? This cannot be undone.")) return;
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
