import {
  createAsync,
  revalidate,
  useAction,
  useSearchParams,
} from "@solidjs/router";
import {
  ErrorBoundary,
  Suspense,
  batch,
  createEffect,
  createSignal,
  createMemo,
} from "solid-js";
import {
  bulkSetSource,
  bulkDeleteDocs,
  deleteAllDocs,
  deleteBySource,
  fetchDocs,
  fetchDocsServerNow,
  fetchSources,
  processPathRound,
  scanRelativeImages,
  bulkUpdateMeta,
} from "../data/docs.service";
import { cleanupTitles, cleanupTitlesDryRun } from "../data/docs-cleanup";
import { useServerSearch } from "../hooks/useServerSearch";
import { createDocsQueryStore } from "../state/docsQuery";
import { ActionsPopover } from "./ActionsPopover";
import { FiltersPanel } from "./FiltersPanel";
import { ResultsSection } from "./ResultsSection";
import { SearchInput } from "./SearchInput";
import { BulkMetaModal } from "./BulkMetaModal";
import { BulkPathModal } from "./BulkPathModal";
import { SelectionPopover } from "./SelectionPopover";
import { updateDoc } from "~/services/docs.service";
import { logSearchResultOpened } from "~/services/activity/activity.actions";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { Spinner } from "~/components/ui/spinner";
import { Text } from "~/components/ui/text";
import { Box, Container, Flex, HStack, Stack } from "styled-system/jsx";

// TOOD: refactor all the query param stuff into a helper

const DocsIndexPage = () => {
  const q = createDocsQueryStore();
  type FiltersPanelStore = ReturnType<typeof createDocsQueryStore> & {
    blankPathOnly: () => boolean;
    setBlankPathOnly: (v: boolean) => void;
  };
  const [searchParams, setSearchParams] = useSearchParams();
  let initializedFromUrl = false;
  let lastSearchSnapshot = "";
  let lastStoreSearchSnapshot = "";
  let isFirstUrlSync = true;
  let syncingFromUrl = false;
  let syncingToUrl = false;
  // We avoid echo loops by comparing nextSearch to location.search; a separate
  // suppression flag is unnecessary and can swallow the first user change.
  const MANAGED_KEYS = [
    "q",
    "pathPrefix",
    "pathBlankOnly",
    "metaKey",
    "metaValue",
    "source",
    "originalContentId",
    "createdFrom",
    "createdTo",
    "updatedFrom",
    "updatedTo",
    "activityClass",
    "sortMode",
    "clientShown",
    "serverShown",
  ];

  const parseParamsIntoStore = (sp: URLSearchParams) => {
    const qp = (key: string) => sp.get(key) || "";
    const num = (key: string, def: number) => {
      const v = Number(sp.get(key));
      return Number.isFinite(v) && v > 0 ? v : def;
    };
    const parseSortMode = (
      value: string,
    ):
      | "relevance"
      | "recent_activity"
      | "most_viewed_30d"
      | "most_edited_30d" => {
      if (
        value === "recent_activity" ||
        value === "most_viewed_30d" ||
        value === "most_edited_30d"
      ) {
        return value;
      }
      return "relevance";
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
      originalContentId: qp("originalContentId"),
      createdFrom: qp("createdFrom"),
      createdTo: qp("createdTo"),
      updatedFrom: qp("updatedFrom"),
      updatedTo: qp("updatedTo"),
      activityClass: qp("activityClass"),
      sortMode: parseSortMode(qp("sortMode")),
      clientShown: num("clientShown", 100),
      serverShown: num("serverShown", 25),
    };

    // Handle load counts directly to avoid multi-step reactive churn.
    const desiredClient = Math.max(100, next.clientShown);
    const desiredServer = Math.max(25, next.serverShown);

    batch(() => {
      // Apply only when changes are detected to avoid loops.
      if (q.searchText() !== next.searchText) q.setSearchText(next.searchText);
      if (q.pathPrefix() !== next.pathPrefix) q.setPathPrefix(next.pathPrefix);
      if (q.blankPathOnly() !== next.blankPathOnly)
        q.setBlankPathOnly(next.blankPathOnly);
      if (q.metaKey() !== next.metaKey) q.setMetaKey(next.metaKey);
      if (q.metaValue() !== next.metaValue) q.setMetaValue(next.metaValue);
      if (q.source() !== next.source) q.setSource(next.source);
      if (q.originalContentId() !== next.originalContentId)
        q.setOriginalContentId(next.originalContentId);
      if (q.createdFrom() !== next.createdFrom)
        q.setCreatedFrom(next.createdFrom || undefined);
      if (q.createdTo() !== next.createdTo)
        q.setCreatedTo(next.createdTo || undefined);
      if (q.updatedFrom() !== next.updatedFrom)
        q.setUpdatedFrom(next.updatedFrom || undefined);
      if (q.updatedTo() !== next.updatedTo)
        q.setUpdatedTo(next.updatedTo || undefined);
      if (q.activityClass() !== next.activityClass)
        q.setActivityClass(next.activityClass);
      if (q.sortMode() !== next.sortMode) q.setSortMode(next.sortMode);
      if (q.clientShown() !== desiredClient) q.setClientShown(desiredClient);
      if (q.serverShown() !== desiredServer) q.setServerShown(desiredServer);
    });
  };

  const readParam = (key: string) => {
    const value = searchParams[key];
    return typeof value === "string" ? value : "";
  };

  const buildManagedSearch = () => {
    const params = new URLSearchParams();
    for (const key of MANAGED_KEYS) {
      const value = readParam(key);
      if (value) params.set(key, value);
    }
    return params;
  };

  // Initialize from URL and keep store in sync when URL changes (e.g., back/forward)
  createEffect(() => {
    if (syncingToUrl) {
      syncingToUrl = false;
      return;
    }
    const currentParams = buildManagedSearch();
    const currentSearch = currentParams.toString()
      ? `?${currentParams.toString()}`
      : "";
    // Guard against re-entering URL->store sync when URL and store are already aligned.
    if (isFirstUrlSync || currentSearch !== lastSearchSnapshot) {
      lastSearchSnapshot = currentSearch;
      isFirstUrlSync = false;
      syncingFromUrl = true;
      try {
        parseParamsIntoStore(currentParams);
      } finally {
        syncingFromUrl = false;
      }
      lastStoreSearchSnapshot = currentSearch;
      initializedFromUrl = true;
    }
  });

  // Push store changes into URL (replace to avoid noisy history during typing)
  createEffect(() => {
    if (!initializedFromUrl) return; // wait until initial URL -> store sync
    if (syncingFromUrl) return;
    const params = new URLSearchParams();
    if (q.searchText().trim()) params.set("q", q.searchText().trim());
    if (q.pathPrefix().trim()) params.set("pathPrefix", q.pathPrefix().trim());
    if (q.blankPathOnly()) params.set("pathBlankOnly", "1");
    if (q.metaKey().trim()) params.set("metaKey", q.metaKey().trim());
    if (q.metaValue().trim()) params.set("metaValue", q.metaValue().trim());
    if (q.source().trim()) params.set("source", q.source().trim());
    if (q.originalContentId().trim())
      params.set("originalContentId", q.originalContentId().trim());
    if (q.createdFrom().trim())
      params.set("createdFrom", q.createdFrom().trim());
    if (q.createdTo().trim()) params.set("createdTo", q.createdTo().trim());
    if (q.updatedFrom().trim())
      params.set("updatedFrom", q.updatedFrom().trim());
    if (q.updatedTo().trim()) params.set("updatedTo", q.updatedTo().trim());
    if (q.activityClass().trim())
      params.set("activityClass", q.activityClass().trim());
    if (q.sortMode() !== "relevance") params.set("sortMode", q.sortMode());
    if (q.clientShown() !== 100)
      params.set("clientShown", String(q.clientShown()));
    if (q.serverShown() !== 25)
      params.set("serverShown", String(q.serverShown()));

    const nextSearch = params.toString() ? `?${params.toString()}` : "";
    if (nextSearch === lastStoreSearchSnapshot) return;
    if (nextSearch !== lastSearchSnapshot) {
      // Explicitly clear all managed keys so removed ones (like q) are deleted
      const obj: Record<string, string | undefined> = {};
      for (const k of MANAGED_KEYS) obj[k] = undefined;
      for (const [k, v] of params.entries()) obj[k] = v;
      lastSearchSnapshot = nextSearch;
      lastStoreSearchSnapshot = nextSearch;
      syncingToUrl = true;
      setSearchParams(obj, { replace: true });
    }
  });

  const docsQueryArgs = () => ({
    pathPrefix: q.pathPrefix() || undefined,
    pathBlankOnly: q.blankPathOnly() || undefined,
    metaKey: q.metaKey() || undefined,
    metaValue: q.metaValue() || undefined,
    source: q.source() || undefined,
    originalContentId: q.originalContentId() || undefined,
    createdFrom: q.createdFrom() || undefined,
    createdTo: q.createdTo() || undefined,
    updatedFrom: q.updatedFrom() || undefined,
    updatedTo: q.updatedTo() || undefined,
    activityClass: (q.activityClass() || undefined) as
      | "READ_HEAVY"
      | "EDIT_HEAVY"
      | "BALANCED"
      | "COLD"
      | undefined,
    sortMode: q.sortMode(),
  });

  const docs = createAsync(() => fetchDocs(docsQueryArgs()));
  const docsServerNow = createAsync(() => fetchDocsServerNow());
  const sources = createAsync(() => fetchSources());
  const refreshDocs = () => revalidate(fetchDocs.keyFor(docsQueryArgs()));
  const refreshSources = () => revalidate(fetchSources.key);

  const [visibleIds, setVisibleIds] = createSignal<string[]>([]);
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const [showBulkMeta, setShowBulkMeta] = createSignal(false);
  const [showBulkPath, setShowBulkPath] = createSignal(false);
  const [bulkBusy, setBulkBusy] = createSignal(false);
  const [bulkError, setBulkError] = createSignal<string | undefined>(undefined);
  const runCleanupTitles = useAction(cleanupTitles);
  const runUpdateDoc = useAction(updateDoc);
  const runBulkSetSource = useAction(bulkSetSource);
  const runDeleteBySource = useAction(deleteBySource);
  const runDeleteAllDocs = useAction(deleteAllDocs);
  const runProcessPathRound = useAction(processPathRound);
  const runScanRelativeImages = useAction(scanRelativeImages);
  const runBulkDeleteDocs = useAction(bulkDeleteDocs);
  const runBulkUpdateMeta = useAction(bulkUpdateMeta);
  const runLogSearchResultOpened = useAction(logSearchResultOpened);
  const isSearching = createMemo(() => q.searchText().trim().length > 0);
  const totalResultsCount = createMemo(() =>
    isSearching() ? serverResults().length : (docs() || []).length,
  );
  const selectedVisibleCount = createMemo(() => {
    const selected = selectedIds();
    let count = 0;
    for (const id of visibleIds()) if (selected.has(id)) count++;
    return count;
  });
  const handleToggleSelect = (id: string, next: boolean) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(id);
      else s.delete(id);
      return s;
    });
  };
  const handleSelectAllVisible = () => {
    const ids = visibleIds();
    if (!ids.length) return;
    setSelectedIds(new Set(ids));
  };
  const handleSelectNone = () => {
    if (selectedIds().size === 0) return;
    setSelectedIds(new Set<string>());
  };

  const { results: serverResults, loading: serverLoading } = useServerSearch(
    q.searchText,
    () => ({
      pathPrefix: q.pathPrefix(),
      blankPathOnly: q.blankPathOnly() || undefined,
      metaKey: q.metaKey(),
      metaValue: q.metaValue(),
      source: q.source() || undefined,
      originalContentId: q.originalContentId() || undefined,
      createdFrom: q.createdFrom() || undefined,
      createdTo: q.createdTo() || undefined,
      updatedFrom: q.updatedFrom() || undefined,
      updatedTo: q.updatedTo() || undefined,
      activityClass: (q.activityClass() || undefined) as
        | "READ_HEAVY"
        | "EDIT_HEAVY"
        | "BALANCED"
        | "COLD"
        | undefined,
      sortMode: q.sortMode(),
    }),
    () => Math.max(50, Math.min(200, q.serverShown() + 50)),
  );

  const handleBulkSetSource = async () => {
    const value = prompt("Enter source to set on all notes (originalSource):");
    if (!value) return;
    await runBulkSetSource(value);
    await refreshDocs();
  };

  const handleSearchResultOpen = (id: string) => {
    const query = q.searchText().trim();
    if (!query) return;
    const tokenCount = query
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2).length;
    void runLogSearchResultOpened({
      docId: id,
      queryPreview: query.slice(0, 120),
      queryLength: query.length,
      tokenCount,
    });
  };

  const handleCleanupTitles = async () => {
    const pre = await cleanupTitlesDryRun();
    const count = Number(pre.candidates || 0);
    if (!count) {
      alert("No titles to clean.");
      return;
    }
    if (
      !confirm(
        `Clean bad titles for ${count} notes? This will remove long hex-like blocks.`,
      )
    )
      return;
    await runCleanupTitles();
    await Promise.all([refreshDocs(), refreshSources()]);
  };

  const handleDeleteBySource = async (source: string, count: number) => {
    if (
      !confirm(
        `Delete all notes for "${source}" (${count})? This cannot be undone.`,
      )
    )
      return;
    await runDeleteBySource(source);
    await Promise.all([refreshDocs(), refreshSources()]);
  };

  const handleProcessPathRound = async () => {
    const res = await runProcessPathRound();
    await Promise.all([refreshDocs(), refreshSources()]);
    alert(
      `Processed path round. Updated: ${res.updated}, Failed: ${res.failed}.`,
    );
  };

  const handleDeleteAll = async () => {
    const total = sources()?.total ?? 0;
    if (!confirm(`Delete ALL notes (${total})? This cannot be undone.`)) return;
    await runDeleteAllDocs();
    await Promise.all([refreshDocs(), refreshSources()]);
  };

  const handleDeleteSelected = async () => {
    const ids = visibleIds().filter((id) => selectedIds().has(id));
    const count = ids.length;
    if (!count) {
      alert("No selected visible notes to delete.");
      return;
    }
    if (!confirm(`Delete the ${count} selected notes? This cannot be undone.`))
      return;
    await runBulkDeleteDocs(ids);
    // Remove deleted ids from selection
    setSelectedIds((prev) => {
      const s = new Set(prev);
      for (const id of ids) s.delete(id);
      return s;
    });
    await Promise.all([refreshDocs(), refreshSources()]);
  };

  const handleOpenBulkMeta = () => setShowBulkMeta(true);
  const handleCloseBulkMeta = () => {
    if (bulkBusy()) return;
    setShowBulkMeta(false);
    setBulkError(undefined);
  };
  const handleOpenBulkPath = () => setShowBulkPath(true);
  const handleCloseBulkPath = () => {
    if (bulkBusy()) return;
    setShowBulkPath(false);
    setBulkError(undefined);
  };
  const handleApplyBulkMeta = async (
    actions: {
      type: "add" | "update" | "remove";
      key: string;
      value?: unknown;
    }[],
  ) => {
    const ids = visibleIds().filter((id) => selectedIds().has(id));
    const count = ids.length;
    if (!count) {
      alert("No selected visible notes.");
      return;
    }
    if (
      !confirm(`Apply ${actions.length} action(s) to ${count} selected notes?`)
    )
      return;
    setBulkBusy(true);
    setBulkError(undefined);
    try {
      await runBulkUpdateMeta(ids, actions as any);
      await refreshDocs();
      setShowBulkMeta(false);
    } catch (e) {
      setBulkError((e as Error).message || "Failed to apply metadata");
    } finally {
      setBulkBusy(false);
    }
  };
  const handleApplyBulkPath = async (path: string) => {
    const ids = visibleIds().filter((id) => selectedIds().has(id));
    const count = ids.length;
    if (!count) {
      alert("No selected visible notes.");
      return;
    }
    if (!confirm(`Set path for ${count} selected notes?`)) return;
    setBulkBusy(true);
    setBulkError(undefined);
    try {
      await Promise.all(ids.map((id) => runUpdateDoc({ id, path })));
      await refreshDocs();
      setShowBulkPath(false);
    } catch (e) {
      setBulkError((e as Error).message || "Failed to update paths");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleScanRelativeImages = async () => {
    const pre = await runScanRelativeImages({ dryRun: true });
    const count = Number(pre.matches || 0);
    if (!count) {
      alert("No notes found with relative image links.");
      return;
    }
    if (
      !confirm(
        `Mark ${count} notes with meta has_relative_image=true? This updates note metadata.`,
      )
    )
      return;
    const res = await runScanRelativeImages({});
    await Promise.all([refreshDocs(), refreshSources()]);
    alert(`Updated: ${res.updated ?? 0}, Failed: ${res.failed ?? 0}.`);
  };

  return (
    <Box as="main" minH="100vh" bg="white">
      <Flex align="stretch" minH="100vh">
        <Box flex="1" minW="0">
          <Container py="1.5rem" px="1rem" maxW="900px">
            <Stack gap="1.25rem">
              <Stack gap="2" px="0.25rem">
                <Flex
                  align="center"
                  justify="space-between"
                  gap="0.75rem"
                  flexWrap="wrap"
                >
                  <HStack gap="3" alignItems="center" flexWrap="wrap">
                    <Heading as="h1" fontSize="2xl">
                      Notes
                    </Heading>
                    <Box borderRadius="full" px="2.5" py="0.75" bg="bg.subtle">
                      <Text fontSize="xs" color="black.a7">
                        Selected: {selectedVisibleCount()}
                      </Text>
                    </Box>
                    <Box borderRadius="full" px="2.5" py="0.75" bg="bg.subtle">
                      <Text fontSize="xs" color="black.a7">
                        Visible: {visibleIds().length}
                      </Text>
                    </Box>
                    <Box borderRadius="full" px="2.5" py="0.75" bg="bg.subtle">
                      <Text fontSize="xs" color="black.a7">
                        Results: {totalResultsCount()}
                      </Text>
                    </Box>
                  </HStack>
                  <HStack gap="2" alignItems="center">
                    <SelectionPopover
                      visibleCount={visibleIds().length}
                      selectedCount={selectedVisibleCount()}
                      onSelectAll={handleSelectAllVisible}
                      onClearSelection={handleSelectNone}
                      onDeleteSelected={handleDeleteSelected}
                      onBulkMeta={handleOpenBulkMeta}
                      onBulkPath={handleOpenBulkPath}
                    />
                    <ActionsPopover
                      sources={sources}
                      onBulkSetSource={handleBulkSetSource}
                      onCleanupTitles={handleCleanupTitles}
                      onProcessPathRound={handleProcessPathRound}
                      onScanRelativeImages={handleScanRelativeImages}
                      onDeleteBySource={handleDeleteBySource}
                      onDeleteAll={handleDeleteAll}
                    />
                  </HStack>
                </Flex>
                <SearchInput
                  value={q.searchText()}
                  onChange={(v) => {
                    q.setSearchText(v);
                    q.resetPaging();
                  }}
                />
                <FiltersPanel
                  q={q as unknown as FiltersPanelStore}
                  sources={sources()?.sources ?? []}
                />
              </Stack>

              <ErrorBoundary
                fallback={(err) => {
                  console.error("[DocsIndex] ResultsSection crashed", err);
                  return (
                    <Text textStyle="sm" color="red.700">
                      Notes list crashed. Check console for `[DocsIndex]
                      ResultsSection crashed`.
                    </Text>
                  );
                }}
              >
                <Suspense
                  fallback={
                    <HStack gap="0.5rem">
                      <Spinner />
                      <Text textStyle="sm" color="black.a7">
                        Loading…
                      </Text>
                    </HStack>
                  }
                >
                  <ResultsSection
                    items={docs() || []}
                    query={q}
                    nowMs={docsServerNow()}
                    serverResults={serverResults() || []}
                    serverLoading={serverLoading()}
                    onVisibleIdsChange={setVisibleIds}
                    selectedIds={selectedIds()}
                    onToggleSelect={handleToggleSelect}
                    onResultOpen={handleSearchResultOpen}
                  />
                </Suspense>
              </ErrorBoundary>
              <BulkMetaModal
                open={showBulkMeta()}
                onClose={handleCloseBulkMeta}
                selectedCount={selectedVisibleCount()}
                onApply={handleApplyBulkMeta}
              />
              <BulkPathModal
                open={showBulkPath()}
                onClose={handleCloseBulkPath}
                selectedCount={selectedVisibleCount()}
                onApply={handleApplyBulkPath}
              />
            </Stack>
          </Container>
        </Box>
      </Flex>
    </Box>
  );
};

export default DocsIndexPage;
