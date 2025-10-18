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

const DocsIndex: VoidComponent = () => {
  const [docs] = createResource(fetchDocs);

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4 space-y-4">
        <h1 class="text-2xl font-bold">Notes</h1>
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
