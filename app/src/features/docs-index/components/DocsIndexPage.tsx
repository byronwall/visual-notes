import { useLocation, useSearchParams } from "@solidjs/router";
import { Suspense, createEffect, createResource } from "solid-js";
import {
  bulkSetSource,
  deleteAllDocs,
  deleteBySource,
  fetchDocs,
  fetchSources,
  processPathRound,
} from "../data/docs.service";
import { useServerSearch } from "../hooks/useServerSearch";
import { createDocsQueryStore } from "../state/docsQuery";
import { ActionsPopover } from "./ActionsPopover";
import { FiltersPanel } from "./FiltersPanel";
import { ResultsSection } from "./ResultsSection";
import { SearchInput } from "./SearchInput";

// TOOD: refactor all the query param stuff into a helper

const DocsIndexPage = () => {
  const q = createDocsQueryStore();
  type FiltersPanelStore = ReturnType<typeof createDocsQueryStore> & {
    blankPathOnly: () => boolean;
    setBlankPathOnly: (v: boolean) => void;
  };
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  let initializedFromUrl = false;
  let lastSearchSnapshot = "";
  let isFirstUrlSync = true;
  // We avoid echo loops by comparing nextSearch to location.search; a separate
  // suppression flag is unnecessary and can swallow the first user change.

  const parseParamsIntoStore = (sp: URLSearchParams) => {
    const qp = (key: string) => sp.get(key) || "";
    const num = (key: string, def: number) => {
      const v = Number(sp.get(key));
      return Number.isFinite(v) && v > 0 ? v : def;
    };

    const next = {
      searchText: qp("q"),
      pathPrefix: qp("pathPrefix"),
      blankPathOnly: (() => {
        const v = qp("pathBlankOnly").toLowerCase();
        return v === "1" || v === "true";
      })(),
      metaKey: qp("metaKey"),
      metaValue: qp("metaValue"),
      source: qp("source"),
      createdFrom: qp("createdFrom"),
      createdTo: qp("createdTo"),
      updatedFrom: qp("updatedFrom"),
      updatedTo: qp("updatedTo"),
      clientShown: num("clientShown", 100),
      serverShown: num("serverShown", 25),
    };

    // Apply only when changes are detected to avoid loops
    if (q.searchText() !== next.searchText) q.setSearchText(next.searchText);
    if (q.pathPrefix() !== next.pathPrefix) q.setPathPrefix(next.pathPrefix);
    if (q.blankPathOnly() !== next.blankPathOnly)
      q.setBlankPathOnly(next.blankPathOnly);
    if (q.metaKey() !== next.metaKey) q.setMetaKey(next.metaKey);
    if (q.metaValue() !== next.metaValue) q.setMetaValue(next.metaValue);
    if (q.source() !== next.source) q.setSource(next.source);
    if (q.createdFrom() !== next.createdFrom)
      q.setCreatedFrom(next.createdFrom || undefined);
    if (q.createdTo() !== next.createdTo)
      q.setCreatedTo(next.createdTo || undefined);
    if (q.updatedFrom() !== next.updatedFrom)
      q.setUpdatedFrom(next.updatedFrom || undefined);
    if (q.updatedTo() !== next.updatedTo)
      q.setUpdatedTo(next.updatedTo || undefined);
    // Handle load counts with reset + incremental add (no direct setter available across app)
    const desiredClient = Math.max(100, next.clientShown);
    const desiredServer = Math.max(25, next.serverShown);
    let didReset = false;
    if (q.clientShown() !== desiredClient) {
      q.resetPaging();
      didReset = true;
      if (desiredClient > 100) q.showMoreClient(desiredClient - 100);
    }
    if (q.serverShown() !== desiredServer) {
      if (!didReset) q.resetPaging();
      if (desiredServer > 25) q.showMoreServer(desiredServer - 25);
    }
  };

  // Initialize from URL and keep store in sync when URL changes (e.g., back/forward)
  createEffect(() => {
    const currentSearch = location.search || "";
    if (isFirstUrlSync || currentSearch !== lastSearchSnapshot) {
      lastSearchSnapshot = currentSearch;
      isFirstUrlSync = false;
      const sp = new URLSearchParams(currentSearch);
      console.log("[DocsIndex] Sync from URL", currentSearch);
      parseParamsIntoStore(sp);
      initializedFromUrl = true;
    }
  });

  // Push store changes into URL (replace to avoid noisy history during typing)
  createEffect(() => {
    if (!initializedFromUrl) return; // wait until initial URL -> store sync
    const params = new URLSearchParams();
    if (q.searchText().trim()) params.set("q", q.searchText().trim());
    if (q.pathPrefix().trim()) params.set("pathPrefix", q.pathPrefix().trim());
    if (q.blankPathOnly()) params.set("pathBlankOnly", "1");
    if (q.metaKey().trim()) params.set("metaKey", q.metaKey().trim());
    if (q.metaValue().trim()) params.set("metaValue", q.metaValue().trim());
    if (q.source().trim()) params.set("source", q.source().trim());
    if (q.createdFrom().trim())
      params.set("createdFrom", q.createdFrom().trim());
    if (q.createdTo().trim()) params.set("createdTo", q.createdTo().trim());
    if (q.updatedFrom().trim())
      params.set("updatedFrom", q.updatedFrom().trim());
    if (q.updatedTo().trim()) params.set("updatedTo", q.updatedTo().trim());
    if (q.clientShown() !== 100)
      params.set("clientShown", String(q.clientShown()));
    if (q.serverShown() !== 25)
      params.set("serverShown", String(q.serverShown()));

    const nextSearch = params.toString() ? `?${params.toString()}` : "";
    console.log("[DocsIndex] Compute URL from store", {
      nextSearch,
      currentSearch: location.search || "",
      searchText: q.searchText(),
      pathPrefix: q.pathPrefix(),
      metaKey: q.metaKey(),
      metaValue: q.metaValue(),
      source: q.source(),
      createdFrom: q.createdFrom(),
      createdTo: q.createdTo(),
      updatedFrom: q.updatedFrom(),
      updatedTo: q.updatedTo(),
    });
    if (nextSearch !== (location.search || "")) {
      console.log("[DocsIndex] Sync to URL", nextSearch);
      // Explicitly clear all managed keys so removed ones (like q) are deleted
      const MANAGED_KEYS = [
        "q",
        "pathPrefix",
        "pathBlankOnly",
        "metaKey",
        "metaValue",
        "source",
        "createdFrom",
        "createdTo",
        "updatedFrom",
        "updatedTo",
        "clientShown",
        "serverShown",
      ];
      const obj: Record<string, string | undefined> = {};
      for (const k of MANAGED_KEYS) obj[k] = undefined;
      for (const [k, v] of params.entries()) obj[k] = v;
      setSearchParams(obj, { replace: true });
    }
  });

  const [docs, { refetch }] = createResource(
    () => ({
      p: q.pathPrefix(),
      b: q.blankPathOnly(),
      k: q.metaKey(),
      v: q.metaValue(),
      s: q.source(),
      cFrom: q.createdFrom(),
      cTo: q.createdTo(),
      uFrom: q.updatedFrom(),
      uTo: q.updatedTo(),
    }),
    (s) =>
      fetchDocs({
        pathPrefix: s.p || undefined,
        pathBlankOnly: s.b || undefined,
        metaKey: s.k || undefined,
        metaValue: s.v || undefined,
        source: s.s || undefined,
        createdFrom: s.cFrom || undefined,
        createdTo: s.cTo || undefined,
        updatedFrom: s.uFrom || undefined,
        updatedTo: s.uTo || undefined,
      })
  );

  const [sources, { refetch: refetchSources }] = createResource(fetchSources);

  const { results: serverResults, loading: serverLoading } = useServerSearch(
    q.searchText,
    () => ({
      pathPrefix: q.pathPrefix(),
      blankPathOnly: q.blankPathOnly() || undefined,
      metaKey: q.metaKey(),
      metaValue: q.metaValue(),
      source: q.source() || undefined,
      createdFrom: q.createdFrom() || undefined,
      createdTo: q.createdTo() || undefined,
      updatedFrom: q.updatedFrom() || undefined,
      updatedTo: q.updatedTo() || undefined,
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

  const handleProcessPathRound = async () => {
    const res = await processPathRound();
    try {
      console.log("[DocsIndex] path round", res);
    } catch {}
    await Promise.all([refetch(), refetchSources()]);
    alert(
      `Processed path round. Updated: ${res.updated}, Failed: ${res.failed}.`
    );
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
              onProcessPathRound={handleProcessPathRound}
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

          <FiltersPanel q={(q as unknown as FiltersPanelStore)} sources={sources()?.sources ?? []} />

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
