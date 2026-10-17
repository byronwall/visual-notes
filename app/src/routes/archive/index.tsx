import { Title } from "@solidjs/meta";
import { createAsync, revalidate, useAction, useSearchParams } from "@solidjs/router";
import { createMemo } from "solid-js";
import { Box, Container } from "styled-system/jsx";
import { ArchiveDetailDrawer } from "~/components/archive/ArchiveDetailDrawer";
import { ArchiveList } from "~/components/archive/list/ArchiveList";
import { ArchiveListToolbar } from "~/components/archive/list/ArchiveListToolbar";
import {
  UNGROUPED_FILTER,
  capturedSinceToIso,
  isCapturedSincePreset,
  matchesArchiveSearch,
} from "~/components/archive/list/archive-list-filters";
import { deleteArchivedPage, updateArchivedPage } from "~/services/archive/archive.actions";
import {
  fetchArchivedPageDetail,
  fetchArchivedPageGroupSummaries,
  fetchArchivedPageGroups,
  fetchArchivedPageTotals,
  fetchArchivedPages,
} from "~/services/archive/archive.service";

const readParam = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) || "";

const ArchivePage = () => {
  const [params, setParams] = useSearchParams();
  const runUpdateArchivedPage = useAction(updateArchivedPage);
  const runDeleteArchivedPage = useAction(deleteArchivedPage);

  const group = () => readParam(params.group);
  const search = () => readParam(params.q);
  const since = () => {
    const value = readParam(params.since);
    return isCapturedSincePreset(value) ? value : "";
  };
  const hostname = () => readParam(params.hostname);
  const selectedId = () => readParam(params.item) || undefined;
  const hasCustomRange = () => Boolean(readParam(params.capturedFrom) || readParam(params.capturedTo));

  const filters = createMemo(() => {
    const preset = since();
    return {
      group: group() && group() !== UNGROUPED_FILTER ? group() : undefined,
      hostname: hostname() || undefined,
      capturedFrom: preset ? capturedSinceToIso(preset) : readParam(params.capturedFrom) || undefined,
      capturedTo: preset ? undefined : readParam(params.capturedTo) || undefined,
    };
  });

  const items = createAsync(() => fetchArchivedPages(filters()));
  const groups = createAsync(() => fetchArchivedPageGroups());
  const groupSummaries = createAsync(() => fetchArchivedPageGroupSummaries());
  const totals = createAsync(() => fetchArchivedPageTotals());

  const visibleItems = createMemo(() => {
    const list = items.latest ?? [];
    const onlyUngrouped = group() === UNGROUPED_FILTER;
    const query = search();
    return list.filter(
      (item) => (!onlyUngrouped || !item.groupName) && matchesArchiveSearch(item, query),
    );
  });
  const isFiltered = () =>
    Boolean(group() || search() || since() || hostname() || hasCustomRange());

  const groupHref = (name: string) => {
    const next = new URLSearchParams();
    if (name) next.set("group", name);
    for (const key of ["q", "since", "hostname"] as const) {
      const value = readParam(params[key]);
      if (value) next.set(key, value);
    }
    const query = next.toString();
    return query ? `/archive?${query}` : "/archive";
  };

  const setSelectedId = (id: string | undefined) => setParams({ item: id }, { replace: true });

  const stepSelection = (delta: number) => {
    const list = visibleItems();
    const index = list.findIndex((item) => item.id === selectedId());
    const next = list[Math.min(list.length - 1, Math.max(0, index + delta))];
    if (next) setSelectedId(next.id);
  };

  const refreshData = async (pageId?: string) => {
    await Promise.all([
      revalidate(fetchArchivedPages.keyFor(filters())),
      revalidate(fetchArchivedPageGroups.key),
      revalidate(fetchArchivedPageGroupSummaries.key),
      revalidate(fetchArchivedPageTotals.key),
      ...(pageId ? [revalidate(fetchArchivedPageDetail.keyFor(pageId))] : []),
    ]);
  };

  const handleGroupCommit = async (id: string, groupName: string) => {
    await runUpdateArchivedPage({ id, groupName });
    await refreshData(id);
  };

  const handleDelete = async (id: string) => {
    const title = visibleItems().find((item) => item.id === id)?.title ?? "this page";
    if (!confirm(`Delete “${title}” with its captures and notes?`)) return;
    await runDeleteArchivedPage({ id });
    if (selectedId() === id) setSelectedId(undefined);
    await refreshData();
  };

  const clearFilters = () =>
    setParams({
      group: undefined,
      q: undefined,
      since: undefined,
      hostname: undefined,
      capturedFrom: undefined,
      capturedTo: undefined,
    });

  let searchInput: HTMLInputElement | undefined;

  return (
    <Box as="main" minH="100vh" bg="bg.default">
      <Title>Explorer • Visual Notes</Title>
      <Container py={{ base: "3", md: "4" }} px={{ base: "3", md: "5" }} maxW="1200px">
        <ArchiveListToolbar
          group={group()}
          groups={groupSummaries.latest ?? []}
          totals={totals.latest}
          totalCount={visibleItems().length}
          search={search()}
          since={since()}
          hostname={hostname()}
          hasCustomRange={hasCustomRange() && !since()}
          groupHref={groupHref}
          searchRef={(element) => (searchInput = element)}
          onSearch={(value) => setParams({ q: value || undefined }, { replace: true })}
          onSince={(value) =>
            setParams({ since: value || undefined, capturedFrom: undefined, capturedTo: undefined })
          }
          onClearHostname={() => setParams({ hostname: undefined })}
          onClearCustomRange={() => setParams({ capturedFrom: undefined, capturedTo: undefined })}
        />

        <ArchiveList
          items={visibleItems()}
          loaded={items.latest !== undefined}
          isFiltered={isFiltered()}
          selectedId={selectedId()}
          groupOptions={groups.latest ?? []}
          query={search()}
          onSelect={setSelectedId}
          onFilterHost={(host) => setParams({ hostname: host })}
          onGroupCommit={handleGroupCommit}
          onDelete={(id) => void handleDelete(id)}
          onClearFilters={clearFilters}
          onFocusSearch={() => searchInput?.focus()}
        />
      </Container>

      <ArchiveDetailDrawer
        open={Boolean(selectedId())}
        pageId={selectedId()}
        groupOptions={groups.latest ?? []}
        onClose={() => setSelectedId(undefined)}
        onPrev={() => stepSelection(-1)}
        onNext={() => stepSelection(1)}
        onChanged={(pageId) => void refreshData(pageId)}
        onDeleted={(pageId) => {
          if (selectedId() === pageId) setSelectedId(undefined);
          void refreshData();
        }}
      />
    </Box>
  );
};

export default ArchivePage;
