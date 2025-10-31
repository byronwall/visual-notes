import {
  type VoidComponent,
  For,
  Show,
  createResource,
  createSignal,
} from "solid-js";
import { A } from "@solidjs/router";
import { apiFetch } from "~/utils/base-url";

type DocListItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};
type SourceCount = { originalSource: string; count: number };
type SourcesResponse = { total: number; sources: SourceCount[] };

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

async function fetchSources() {
  const res = await apiFetch("/api/docs/sources");
  if (!res.ok) throw new Error("Failed to load sources");
  const json = (await res.json()) as SourcesResponse;
  return json;
}

async function deleteBySource(source: string) {
  const res = await apiFetch(
    `/api/docs/source?originalSource=${encodeURIComponent(source)}`,
    {
      method: "DELETE",
    }
  );
  if (!res.ok) throw new Error("Failed to delete notes by source");
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
  const [sources, { refetch: refetchSources }] = createResource(fetchSources);
  const [cleaning, setCleaning] = createSignal(false);

  const handleDeleteAll = async () => {
    const total = sources()?.total ?? 0;
    if (!confirm(`Delete ALL notes (${total})? This cannot be undone.`)) return;
    try {
      await deleteAllDocs();
      console.log("[DocsIndex] delete all completed");
      await Promise.all([refetch(), refetchSources()]);
    } catch (e) {
      console.error(e);
      alert("Failed to delete all notes");
    }
  };

  const makeDeleteSourceHandler =
    (source: string, count: number) => async () => {
      if (
        !confirm(
          `Delete all notes for “${source}” (${count})? This cannot be undone.`
        )
      )
        return;
      try {
        await deleteBySource(source);
        console.log("[DocsIndex] delete by source completed", source);
        await Promise.all([refetch(), refetchSources()]);
      } catch (e) {
        console.error(e);
        alert(`Failed to delete notes for ${source}`);
      }
    };

  const handleCleanupTitles = async () => {
    setCleaning(true);
    try {
      // Dry run to get count for confirmation
      const pre = await apiFetch("/api/docs/cleanup-titles?dryRun=1", {
        method: "POST",
      });
      const preJson = (await pre.json().catch(() => ({}))) as any;
      const count = Number(preJson?.candidates || 0);
      if (!count) {
        alert("No titles to clean.");
        return;
      }
      if (
        !confirm(
          `Clean bad titles for ${count} notes? This will remove long hex-like blocks.`
        )
      )
        return;
      console.log("[DocsIndex] cleanup starting count=", count);
      const res = await apiFetch("/api/docs/cleanup-titles", {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as any;
      console.log("[DocsIndex] cleanup done", json);
      await Promise.all([refetch(), refetchSources()]);
    } catch (e) {
      console.error(e);
      alert("Failed during title cleanup");
    } finally {
      setCleaning(false);
    }
  };

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
              class="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
              onClick={handleCleanupTitles}
              disabled={cleaning()}
            >
              {cleaning() ? "Cleaning…" : "Clean Bad Titles"}
            </button>
            <Show when={sources()}>
              {(data) => (
                <div class="flex items-center gap-2 overflow-x-auto">
                  <For each={data().sources}>
                    {(s) => (
                      <button
                        class="px-3 py-1.5 rounded bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap"
                        onClick={makeDeleteSourceHandler(
                          s.originalSource,
                          s.count
                        )}
                      >
                        Delete {s.originalSource} ({s.count})
                      </button>
                    )}
                  </For>
                </div>
              )}
            </Show>
            <button
              class="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
              onClick={handleDeleteAll}
            >
              Delete All
              <Show when={sources()}>{(d) => <span> ({d().total})</span>}</Show>
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
                    <span
                      class="text-gray-500 text-sm"
                      title={`Created ${new Date(
                        d.createdAt
                      ).toLocaleString()}`}
                    >
                      {new Date(d.updatedAt).toLocaleString()}
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
