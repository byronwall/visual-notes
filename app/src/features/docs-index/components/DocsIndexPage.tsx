import { Suspense, createResource, Show } from "solid-js";
import { fetchDocs, fetchSources } from "../data/docs.service";
import { createDocsQueryStore } from "../state/docsQuery";
import { useServerSearch } from "../hooks/useServerSearch";
import { SearchInput } from "./SearchInput";
import { FiltersPanel } from "./FiltersPanel";
import { ActionsPopover } from "./ActionsPopover";
import { ResultsSection } from "./ResultsSection";
import {
  bulkSetSource,
  deleteAllDocs,
  deleteBySource,
} from "../data/docs.service";

const DocsIndexPage = () => {
  const q = createDocsQueryStore();

  const [docs, { refetch }] = createResource(
    () => ({ p: q.pathPrefix(), k: q.metaKey(), v: q.metaValue() }),
    (s) =>
      fetchDocs({
        pathPrefix: s.p || undefined,
        metaKey: s.k || undefined,
        metaValue: s.v || undefined,
      })
  );

  const [sources, { refetch: refetchSources }] = createResource(fetchSources);

  const { results: serverResults, loading: serverLoading } = useServerSearch(
    q.searchText,
    () => ({
      pathPrefix: q.pathPrefix(),
      metaKey: q.metaKey(),
      metaValue: q.metaValue(),
    })
  );

  const handleBulkSetSource = async () => {
    const value = prompt("Enter source to set on all notes (originalSource):");
    if (!value) return;
    await bulkSetSource(value);
    await refetch();
  };

  const handleCleanupTitles = async () => {
    // preserve existing route behavior
    const pre = await fetch("/api/docs/cleanup-titles?dryRun=1", {
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
    const res = await fetch("/api/docs/cleanup-titles", { method: "POST" });
    await res.json().catch(() => ({}));
    await Promise.all([refetch(), refetchSources()]);
  };

  const handleDeleteBySource = async (source: string, count: number) => {
    if (
      !confirm(
        `Delete all notes for "${source}" (${count})? This cannot be undone.`
      )
    )
      return;
    await deleteBySource(source);
    await Promise.all([refetch(), refetchSources()]);
  };

  const handleDeleteAll = async () => {
    const total = sources()?.total ?? 0;
    if (!confirm(`Delete ALL notes (${total})? This cannot be undone.`)) return;
    await deleteAllDocs();
    await Promise.all([refetch(), refetchSources()]);
  };

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4 space-y-4">
        <div class="mx-auto max-w-[900px]">
          <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold">Notes</h1>
            <ActionsPopover
              sources={sources}
              onBulkSetSource={handleBulkSetSource}
              onCleanupTitles={handleCleanupTitles}
              onDeleteBySource={handleDeleteBySource}
              onDeleteAll={handleDeleteAll}
            />
          </div>

          <SearchInput
            value={q.searchText()}
            onChange={(v) => {
              q.setSearchText(v);
              q.resetPaging();
            }}
          />

          <FiltersPanel q={q} />

          <Suspense fallback={<p>Loading…</p>}>
            <ResultsSection
              items={docs() || []}
              query={q}
              serverResults={serverResults() || []}
              serverLoading={serverLoading}
            />
          </Suspense>
        </div>
      </div>
    </main>
  );
};

export default DocsIndexPage;
