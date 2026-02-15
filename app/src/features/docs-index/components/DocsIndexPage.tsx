import { createAsync, revalidate, useSearchParams } from "@solidjs/router";
import { ErrorBoundary, Suspense, createMemo } from "solid-js";
import { fetchDocs, fetchDocsServerNow, fetchSources } from "../data/docs.service";
import { useServerSearch } from "../hooks/useServerSearch";
import { createDocsQueryStore } from "../state/docsQuery";
import { DocsIndexHeader } from "./DocsIndexHeader";
import { FiltersPanel } from "./FiltersPanel";
import { ResultsSection } from "./ResultsSection";
import { SearchInput } from "./SearchInput";
import { BulkMetaModal } from "./BulkMetaModal";
import { BulkPathModal } from "./BulkPathModal";
import { PathDiscoveryLinks } from "./PathDiscoveryLinks";
import { useDocsIndexUrlSync } from "../hooks/useDocsIndexUrlSync";
import { useDocsIndexBulkActions } from "../hooks/useDocsIndexBulkActions";
import { fetchPathDiscovery } from "~/services/docs.service";
import { Spinner } from "~/components/ui/spinner";
import { Text } from "~/components/ui/text";
import { Box, Container, HStack, Stack } from "styled-system/jsx";

const DocsIndexPage = () => {
  const q = createDocsQueryStore();
  type FiltersPanelStore = ReturnType<typeof createDocsQueryStore> & {
    blankPathOnly: () => boolean;
    setBlankPathOnly: (v: boolean) => void;
  };
  const [searchParams, setSearchParams] = useSearchParams();
  useDocsIndexUrlSync({ q, searchParams, setSearchParams });

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
  const pathDiscovery = createAsync(() => fetchPathDiscovery());
  const refreshDocs = () => revalidate(fetchDocs.keyFor(docsQueryArgs()));
  const refreshSources = () => revalidate(fetchSources.key);

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
  const actions = useDocsIndexBulkActions({
    q,
    sources,
    refreshDocs,
    refreshSources,
  });
  const isSearching = createMemo(() => q.searchText().trim().length > 0);
  const totalResultsCount = createMemo(() =>
    isSearching() ? serverResults().length : (docs() || []).length,
  );

  return (
    <Box as="main" minH="100vh" bg="white">
      <Container py="1.5rem" px="1rem" maxW="900px">
        <Stack gap="1rem">
          <Stack gap="1.5" px="0.25rem">
            <DocsIndexHeader
              visibleCount={actions.visibleIds().length}
              selectedCount={actions.selectedVisibleCount()}
              totalResultsCount={totalResultsCount()}
              sources={sources}
              onSelectAll={actions.handleSelectAllVisible}
              onClearSelection={actions.handleSelectNone}
              onDeleteSelected={actions.handleDeleteSelected}
              onBulkMeta={actions.handleOpenBulkMeta}
              onBulkPath={actions.handleOpenBulkPath}
              onBulkSetSource={actions.handleBulkSetSource}
              onCleanupTitles={actions.handleCleanupTitles}
              onProcessPathRound={actions.handleProcessPathRound}
              onScanRelativeImages={actions.handleScanRelativeImages}
              onDeleteBySource={actions.handleDeleteBySource}
              onDeleteAll={actions.handleDeleteAll}
            />
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
            <PathDiscoveryLinks data={pathDiscovery()} />
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
                onVisibleIdsChange={actions.setVisibleIds}
                selectedIds={actions.selectedIds()}
                onToggleSelect={actions.handleToggleSelect}
                onResultOpen={actions.handleSearchResultOpen}
              />
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
        </Stack>
      </Container>
    </Box>
  );
};

export default DocsIndexPage;
