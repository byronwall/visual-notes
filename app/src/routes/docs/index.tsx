import {
  type VoidComponent,
  For,
  Show,
  Suspense,
  createResource,
  createSignal,
  createEffect,
  onCleanup,
} from "solid-js";
import { A } from "@solidjs/router";
import { apiFetch } from "~/utils/base-url";
import { MetaKeySuggestions } from "~/components/MetaKeySuggestions";
import { MetaValueSuggestions } from "~/components/MetaValueSuggestions";
import { PathEditor } from "~/components/PathEditor";

type MetaRecord = Record<string, string | number | boolean | null>;
type DocListItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  path?: string | null;
  meta?: MetaRecord | null;
};
type SourceCount = { originalSource: string; count: number };
type SourcesResponse = { total: number; sources: SourceCount[] };

async function fetchDocs(q?: {
  pathPrefix?: string;
  metaKey?: string;
  metaValue?: string;
}) {
  const params = new URLSearchParams();
  if (q?.pathPrefix) params.set("pathPrefix", q.pathPrefix);
  if (q?.metaKey) params.set("metaKey", q.metaKey);
  if (q?.metaValue) params.set("metaValue", q.metaValue);
  const qs = params.toString();
  const url = qs ? `/api/docs?${qs}` : "/api/docs";
  const res = await apiFetch(url);
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
  const [pathPrefix, setPathPrefix] = createSignal("");
  const [metaKey, setMetaKey] = createSignal("");
  const [metaValue, setMetaValue] = createSignal("");

  const [docs, { refetch }] = createResource(
    () => ({ p: pathPrefix(), k: metaKey(), v: metaValue() }),
    (src) =>
      fetchDocs({
        pathPrefix: src.p || undefined,
        metaKey: src.k || undefined,
        metaValue: src.v || undefined,
      })
  );
  const [sources, { refetch: refetchSources }] = createResource(fetchSources);
  const [cleaning, setCleaning] = createSignal(false);
  const [popoverOpen, setPopoverOpen] = createSignal(false);
  let popoverButtonRef: HTMLButtonElement | undefined;
  let popoverRef: HTMLDivElement | undefined;

  const handleSelectMetaKey = (key: string) => {
    setMetaKey(key);
    console.log("[DocsIndex] selected meta key", key);
  };

  const handleSelectMetaValue = (value: string) => {
    setMetaValue(value);
    console.log("[DocsIndex] selected meta value", value);
  };

  const handlePathFilterClick = (pathValue: string) => () => {
    if (!pathValue) return;
    console.log("[DocsIndex] filter by path", pathValue);
    setPathPrefix(pathValue);
  };

  const makeMetaFilterHandler = (key: string, value: string) => () => {
    if (!key) return;
    console.log("[DocsIndex] filter by meta", { key, value });
    setMetaKey(key);
    setMetaValue(value);
  };

  const handleClearMetaFilter = () => {
    setMetaKey("");
    setMetaValue("");
    console.log("[DocsIndex] cleared meta filters");
  };

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
      setPopoverOpen(false);
    } catch (e) {
      console.error(e);
      alert("Failed during title cleanup");
    } finally {
      setCleaning(false);
    }
  };

  const handleTogglePopover = () => {
    setPopoverOpen(!popoverOpen());
  };

  // Close popover on escape key
  createEffect(() => {
    if (!popoverOpen()) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPopoverOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    onCleanup(() => window.removeEventListener("keydown", handleEscape));
  });

  // Close popover when clicking outside
  createEffect(() => {
    if (!popoverOpen()) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef &&
        !popoverRef.contains(target) &&
        popoverButtonRef &&
        !popoverButtonRef.contains(target)
      ) {
        setPopoverOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    onCleanup(() =>
      window.removeEventListener("mousedown", handleClickOutside)
    );
  });

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4 space-y-4">
        <div class="mx-auto max-w-[900px]">
          <div class="flex items-center justify-between relative">
            <h1 class="text-2xl font-bold">Notes</h1>
            <div class="relative">
              <button
                ref={popoverButtonRef}
                class="px-3 py-1.5 rounded border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                onClick={handleTogglePopover}
              >
                <span>⚙️</span>
                <span>Actions</span>
              </button>
              <Show when={popoverOpen()}>
                <div
                  ref={popoverRef}
                  class="absolute right-0 mt-2 w-80 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-3"
                >
                  <div class="space-y-3">
                    <div>
                      <div class="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
                        Bulk Actions
                      </div>
                      <div class="space-y-2">
                        <button
                          class="w-full px-3 py-2 rounded bg-gray-700 text-white text-sm hover:bg-gray-800 disabled:opacity-50 text-left"
                          onClick={async () => {
                            try {
                              await bulkSetSource();
                              await refetch();
                              setPopoverOpen(false);
                            } catch (e) {
                              console.error(e);
                              alert(
                                (e as Error).message || "Failed to set source"
                              );
                            }
                          }}
                        >
                          Set Source (All)
                        </button>
                        <button
                          class="w-full px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 text-left whitespace-nowrap"
                          onClick={handleCleanupTitles}
                          disabled={cleaning()}
                        >
                          {cleaning() ? "Cleaning…" : "Clean Bad Titles"}
                        </button>
                      </div>
                    </div>
                    <div class="border-t border-gray-200 pt-3">
                      <div class="text-xs font-medium text-red-700 mb-2 uppercase tracking-wide">
                        ⚠️ Dangerous Actions
                      </div>
                      <div class="space-y-2">
                        <Show when={sources()}>
                          {(data) => (
                            <For each={data().sources}>
                              {(s) => (
                                <button
                                  class="w-full px-3 py-2 rounded bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-50 text-left whitespace-nowrap"
                                  onClick={async () => {
                                    if (
                                      !confirm(
                                        `Delete all notes for "${s.originalSource}" (${s.count})? This cannot be undone.`
                                      )
                                    ) {
                                      return;
                                    }
                                    try {
                                      await deleteBySource(s.originalSource);
                                      console.log(
                                        "[DocsIndex] delete by source completed",
                                        s.originalSource
                                      );
                                      await Promise.all([
                                        refetch(),
                                        refetchSources(),
                                      ]);
                                      setPopoverOpen(false);
                                    } catch (e) {
                                      console.error(e);
                                      alert(
                                        `Failed to delete notes for ${s.originalSource}`
                                      );
                                    }
                                  }}
                                >
                                  Delete {s.originalSource} ({s.count})
                                </button>
                              )}
                            </For>
                          )}
                        </Show>
                        <button
                          class="w-full px-3 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50 text-left"
                          onClick={async () => {
                            const total = sources()?.total ?? 0;
                            if (
                              !confirm(
                                `Delete ALL notes (${total})? This cannot be undone.`
                              )
                            ) {
                              return;
                            }
                            setPopoverOpen(false);
                            try {
                              await deleteAllDocs();
                              console.log("[DocsIndex] delete all completed");
                              await Promise.all([refetch(), refetchSources()]);
                            } catch (e) {
                              console.error(e);
                              alert("Failed to delete all notes");
                            }
                          }}
                        >
                          Delete All
                          <Show when={sources()}>
                            {(d) => <span> ({d().total})</span>}
                          </Show>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Show>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label class="block text-xs text-gray-600 mb-1">
                Path prefix
              </label>
              <PathEditor
                initialPath={pathPrefix()}
                onChange={(p) => setPathPrefix(p)}
              />
            </div>
            <div>
              <label class="block text-xs text-gray-600 mb-1">Meta key</label>
              <input
                class="w-full border rounded px-2 py-1 text-sm"
                placeholder="tag"
                value={metaKey()}
                onInput={(e) => setMetaKey(e.currentTarget.value)}
              />
              <Suspense fallback={null}>
                <MetaKeySuggestions onSelect={handleSelectMetaKey} />
              </Suspense>
            </div>
            <div>
              <div class="flex items-center justify-between">
                <label class="block text-xs text-gray-600 mb-1">
                  Meta value
                </label>
                <Show when={metaKey().trim() || metaValue().trim()}>
                  <button
                    class="text-xs text-blue-600 hover:underline"
                    onClick={handleClearMetaFilter}
                    title="Clear meta filters"
                  >
                    Clear
                  </button>
                </Show>
              </div>
              <input
                class="w-full border rounded px-2 py-1 text-sm"
                placeholder="design"
                value={metaValue()}
                onInput={(e) => setMetaValue(e.currentTarget.value)}
              />
              <Suspense fallback={null}>
                <MetaValueSuggestions
                  keyName={metaKey()}
                  onSelect={handleSelectMetaValue}
                />
              </Suspense>
            </div>
          </div>
          <Show when={docs()} fallback={<p>Loading…</p>}>
            {(items) => {
              const groups = () => groupByUpdatedAt(items());
              console.log(
                "[DocsIndex] group sizes",
                groups().map((g) => ({ label: g.label, count: g.items.length }))
              );
              return (
                <div class="space-y-6 mt-4">
                  <For each={groups()}>
                    {(g) => (
                      <Show when={g.items.length}>
                        <section>
                          <h2 class="text-sm font-semibold text-gray-600">
                            {g.label}
                          </h2>
                          <ul class="space-y-2 mt-2">
                            <For each={g.items}>
                              {(d) => (
                                <li class="flex items-center justify-between border border-gray-200 rounded p-3 hover:bg-gray-50">
                                  <A
                                    href={`/docs/${d.id}`}
                                    class="font-medium hover:underline"
                                  >
                                    {d.title}
                                  </A>
                                  <div class="flex items-center gap-2 text-sm text-gray-500">
                                    <Show when={d.path}>
                                      {(p) => (
                                        <button
                                          type="button"
                                          class="text-xs px-2 py-0.5 rounded bg-gray-100 border hover:bg-gray-200 cursor-pointer"
                                          onClick={handlePathFilterClick(p())}
                                          title={`Filter by path: ${p()}`}
                                        >
                                          {p()}
                                        </button>
                                      )}
                                    </Show>
                                    <For each={getTopMetaEntries(d.meta)}>
                                      {(entry) => (
                                        <button
                                          type="button"
                                          class="text-xs px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 cursor-pointer"
                                          onClick={makeMetaFilterHandler(
                                            entry[0],
                                            entry[1]
                                          )}
                                          title={`Filter by ${entry[0]}=${entry[1]}`}
                                        >
                                          {entry[0]}: {entry[1]}
                                        </button>
                                      )}
                                    </For>
                                    <span
                                      title={`Updated ${new Date(
                                        d.updatedAt
                                      ).toLocaleString()}`}
                                    >
                                      {formatRelativeTime(d.updatedAt)}
                                    </span>
                                  </div>
                                </li>
                              )}
                            </For>
                          </ul>
                        </section>
                      </Show>
                    )}
                  </For>
                </div>
              );
            }}
          </Show>
        </div>
      </div>
    </main>
  );
};

export default DocsIndex;

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (week < 4) return `${week}w ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;
  const year = Math.floor(day / 365);
  return `${year}y ago`;
}

function getTopMetaEntries(meta?: MetaRecord | null): [string, string][] {
  if (!meta) return [];
  const entries = Object.entries(meta)
    .filter(([, v]) => v !== null && String(v).trim() !== "")
    .slice(0, 3)
    .map(([k, v]) => [k, String(v)] as [string, string]);
  return entries;
}

function groupByUpdatedAt(items: DocListItem[]) {
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  const buckets: Record<string, DocListItem[]> = {
    hour: [],
    day: [],
    week: [],
    month: [],
    year: [],
    older: [],
  };

  for (const d of items) {
    const t = new Date(d.updatedAt).getTime();
    const dt = now - t;
    if (dt <= HOUR) buckets.hour.push(d);
    else if (dt <= DAY) buckets.day.push(d);
    else if (dt <= WEEK) buckets.week.push(d);
    else if (dt <= MONTH) buckets.month.push(d);
    else if (dt <= YEAR) buckets.year.push(d);
    else buckets.older.push(d);
  }

  return [
    { label: "Last hour", items: buckets.hour },
    { label: "Last day", items: buckets.day },
    { label: "Last week", items: buckets.week },
    { label: "Last month", items: buckets.month },
    { label: "Last year", items: buckets.year },
    { label: "Older", items: buckets.older },
  ];
}
