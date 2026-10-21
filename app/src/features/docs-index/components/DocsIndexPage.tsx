import {
  createAsync,
  revalidate,
  useNavigate,
  useSearchParams,
} from "@solidjs/router";
import {
  ErrorBoundary,
  Show,
  Suspense,
  createMemo,
  createSignal,
} from "solid-js";
import {
  fetchDocs,
  fetchDocsServerNow,
  fetchSources,
} from "../data/docs.service";
import { useServerSearch } from "../hooks/useServerSearch";
import { createDocsQueryStore } from "../state/docsQuery";
import { DocsIndexHeader } from "./DocsIndexHeader";
import { DocsToolbar } from "./DocsToolbar";
import { SelectionBar } from "./SelectionBar";
import { ActionsMenu } from "./ActionsMenu";
import { ResultsSection } from "./ResultsSection";
import { SearchInput } from "./SearchInput";
import { ListEmptyState } from "./ListEmptyState";
import { BulkMetaModal } from "./BulkMetaModal";
import { BulkPathModal } from "./BulkPathModal";
import { PathDiscoveryLinks } from "./PathDiscoveryLinks";
import { useDocsIndexUrlSync } from "../hooks/useDocsIndexUrlSync";
import { useDocsIndexBulkActions } from "../hooks/useDocsIndexBulkActions";
import { useDocsListKeyboard } from "../hooks/useDocsListKeyboard";
import { useAskDialog } from "../hooks/useAskDialog";
import { Toaster, toaster } from "~/components/ui/toast";
import { fetchPathDiscovery } from "~/services/docs.service";
import { Spinner } from "~/components/ui/spinner";
import { Box, Container, HStack } from "styled-system/jsx";

// A component (not a pre-built element) so hydration claims its nodes in place.
const LoadingRows = () => (
  <HStack gap="2" px="2" py="6" color="fg.muted" fontSize="sm">
    <Spinner size="xs" />
    Loading notes…
  </HStack>
);

type ActivityClass = "READ_HEAVY" | "EDIT_HEAVY" | "BALANCED" | "COLD";

const DocsIndexPage = () => {
  const q = createDocsQueryStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  useDocsIndexUrlSync({ q, searchParams, setSearchParams });

  const filterArgs = () => ({
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
      | ActivityClass
      | undefined,
    collectionRows: q.collectionRows() || undefined,
    sortMode: q.sortMode(),
  });

  const docs = createAsync(() => fetchDocs(filterArgs()));
  const docsServerNow = createAsync(() => fetchDocsServerNow());
  const sources = createAsync(() => fetchSources());
  const pathDiscovery = createAsync(() => fetchPathDiscovery());
  const refreshDocs = () => revalidate(fetchDocs.keyFor(filterArgs()));
  const refreshSources = () => revalidate(fetchSources.key);

  const search = useServerSearch(q.searchText, filterArgs, () =>
    Math.max(50, Math.min(200, q.serverShown() + 50)),
  );
  const ask = useAskDialog();
  const actions = useDocsIndexBulkActions({
    q,
    sources,
    refreshDocs,
    refreshSources,
    ui: {
      confirm: ask.confirm,
      promptText: ask.promptText,
      notify: (title, type = "info") => toaster.create({ title, type }),
    },
  });

  const isSearching = createMemo(() => q.searchText().trim().length > 0);
  const countLabel = createMemo(() => {
    if (isSearching()) {
      if (search.loading() && search.results().length === 0) return "";
      const n = search.results().length;
      return `${n.toLocaleString()} ${n === 1 ? "match" : "matches"}`;
    }
    const list = docs.latest;
    if (!list) return "";
    return `${list.length.toLocaleString()} ${list.length === 1 ? "note" : "notes"}`;
  });

  const setSearch = (v: string) => {
    q.setSearchText(v);
    q.resetPaging();
  };

  const openDoc = (id: string, newTab: boolean) => {
    actions.handleSearchResultOpen(id);
    const href = `/docs/${id}`;
    if (newTab) window.open(href, "_blank", "noopener");
    else navigate(href);
  };

  // Shift-click extends the selection from the last toggled row.
  let lastToggledId: string | null = null;
  const toggleSelect = (id: string, next: boolean, shiftKey: boolean) => {
    const ids = actions.visibleIds();
    if (shiftKey && lastToggledId && lastToggledId !== id) {
      const a = ids.indexOf(lastToggledId);
      const b = ids.indexOf(id);
      if (a >= 0 && b >= 0) {
        actions.handleSetSelected(
          ids.slice(Math.min(a, b), Math.max(a, b) + 1),
          next,
        );
        lastToggledId = id;
        return;
      }
    }
    actions.handleToggleSelect(id, next);
    lastToggledId = id;
  };

  const [searchEl, setSearchEl] = createSignal<HTMLInputElement>();
  const keys = useDocsListKeyboard({
    ids: actions.visibleIds,
    searchInput: searchEl,
    hasSelection: () => actions.selectedIds().size > 0,
    hasSearch: isSearching,
    onOpen: openDoc,
    onToggleSelect: (id) =>
      toggleSelect(id, !actions.selectedIds().has(id), false),
    onClearSelection: actions.handleSelectNone,
    onClearSearch: () => setSearch(""),
  });

  return (
    <Box as="main" minH="100vh" bg="bg.default">
      <Container px={{ base: "3", md: "6" }} pb="16" maxW="960px">
        <DocsIndexHeader
          countLabel={countLabel()}
          search={
            <SearchInput
              ref={setSearchEl}
              value={q.searchText()}
              loading={isSearching() && search.loading()}
              onChange={setSearch}
              onKeyDown={keys.handleSearchKeyDown}
            />
          }
          actions={
            <ActionsMenu
              sources={sources}
              onBulkSetSource={actions.handleBulkSetSource}
              onCleanupTitles={actions.handleCleanupTitles}
              onProcessPathRound={actions.handleProcessPathRound}
              onScanRelativeImages={actions.handleScanRelativeImages}
              onDeleteBySource={actions.handleDeleteBySource}
              onDeleteAll={actions.handleDeleteAll}
            />
          }
          toolbar={
            <Show
              when={actions.selectedVisibleCount() > 0}
              fallback={
                <DocsToolbar
                  q={q}
                  isSearching={isSearching()}
                  sources={sources()?.sources}
                />
              }
            >
              <SelectionBar
                selectedCount={actions.selectedVisibleCount()}
                visibleCount={actions.visibleIds().length}
                onSelectAll={actions.handleSelectAllVisible}
                onClear={actions.handleSelectNone}
                onBulkMeta={actions.handleOpenBulkMeta}
                onBulkPath={actions.handleOpenBulkPath}
                onDelete={actions.handleDeleteSelected}
              />
            </Show>
          }
        />
        <Box pb="2">
          <PathDiscoveryLinks data={pathDiscovery()} />
        </Box>

        <ErrorBoundary
          fallback={(err) => {
            console.error("[docs-index] ResultsSection crashed", err);
            return (
              <ListEmptyState
                tone="error"
                message="The notes list failed to render."
              />
            );
          }}
        >
          <Suspense fallback={<LoadingRows />}>
            {/* The first read must suspend so SSR waits for rows; later
                revalidations keep showing the latest rows instead. */}
            <Show when={docs.latest ?? docs()} fallback={<LoadingRows />}>
              {(items) => (
                <ResultsSection
                  items={items()}
                  query={q}
                  nowMs={docsServerNow()}
                  serverResults={search.results()}
                  serverLoading={search.loading()}
                  serverStale={
                    search.loading() &&
                    search.resultsQuery() !== q.searchText().trim()
                  }
                  serverError={search.error()}
                  onSearchRetry={search.refetch}
                  onVisibleIdsChange={actions.setVisibleIds}
                  selectedIds={actions.selectedIds()}
                  activeId={keys.activeId()}
                  hasFilters={q.hasFilters()}
                  onClearFilters={q.resetFilters}
                  onToggleSelect={toggleSelect}
                  onActivate={(id) => openDoc(id, false)}
                  onResultOpen={actions.handleSearchResultOpen}
                />
              )}
            </Show>
          </Suspense>
        </ErrorBoundary>
        <BulkMetaModal
          open={actions.showBulkMeta()}
          onClose={actions.handleCloseBulkMeta}
          selectedCount={actions.selectedVisibleCount()}
          onApply={actions.handleApplyBulkMeta}
        />
        <BulkPathModal
          open={actions.showBulkPath()}
          onClose={actions.handleCloseBulkPath}
          selectedCount={actions.selectedVisibleCount()}
          onApply={actions.handleApplyBulkPath}
        />
        <ask.AskDialogHost />
        {/* No app-level Toaster is mounted yet; drop this if the shell adds one. */}
        <Toaster />
      </Container>
    </Box>
  );
};

export default DocsIndexPage;
