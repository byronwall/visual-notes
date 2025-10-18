import { createResource, For, Show, createSignal, onMount } from "solid-js";

type HistoryRow = {
  dayId: string | null;
  passageId: string;
  planId: string | null;
  updatedAt: string;
  day: { label: string; position: number; planId: string } | null;
  passage: { ref: string; norm: string };
};

async function fetchHistory() {
  console.log("[history] fetching /api/progress/history");
  const res = await fetch("/api/progress/history");
  console.log("[history] response", { status: res.status });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const rows = (await res.json()) as HistoryRow[];
  console.log("[history] rows", { count: rows.length });
  return rows;
}

export default function HistoryPage() {
  const [mounted, setMounted] = createSignal(false);
  onMount(() => setMounted(true));
  onMount(() => console.log("[history] page mounted"));
  const [history] = createResource(mounted, fetchHistory);

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4">
        <h2 class="text-xl font-semibold mb-4">Reading History</h2>
        <Show
          when={mounted() && !history.loading}
          fallback={<div class="card">Loading…</div>}
        >
          <Show
            when={history()?.length}
            fallback={
              <div class="card">
                <p class="small">No history yet.</p>
              </div>
            }
          >
            <ul class="flex flex-col gap-2">
              <For each={history()}>
                {(row) => (
                  <li
                    class="card"
                    style="display:flex; justify-content:space-between; align-items:center;"
                  >
                    <div>
                      <div>
                        <strong>{row.passage.ref}</strong>
                      </div>
                      <div class="small" style="color:#6b7280;">
                        {row.day ? row.day.label : "Ad hoc reading"}
                      </div>
                    </div>
                    <div class="small" style="color:#6b7280;">
                      {new Date(row.updatedAt).toLocaleString()}
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Show>
      </div>
    </main>
  );
}
