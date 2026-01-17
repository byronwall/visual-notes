import { useLocation, useSearchParams } from "@solidjs/router";
import {
  Show,
  Suspense,
  createEffect,
  createResource,
  createSignal,
  createMemo,
} from "solid-js";
import {
  bulkSetSource,
  bulkDeleteDocs,
  deleteAllDocs,
  deleteBySource,
  fetchDocs,
  fetchSources,
  processPathRound,
  scanRelativeImages,
  bulkUpdateMeta,
} from "../data/docs.service";
import { useServerSearch } from "../hooks/useServerSearch";
import { createDocsQueryStore } from "../state/docsQuery";
import { ActionsPopover } from "./ActionsPopover";
import { FiltersPanel } from "./FiltersPanel";
import { ResultsSection } from "./ResultsSection";
import { SearchInput } from "./SearchInput";
import { PathTreeSidebar } from "./PathTreeSidebar";
import { BulkMetaModal } from "./BulkMetaModal";
import { BulkPathModal } from "./BulkPathModal";
import { updateDocPath } from "~/services/docs.service";
import { Button } from "~/components/ui/button";
import { CloseButton } from "~/components/ui/close-button";
import * as Drawer from "~/components/ui/drawer";
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
      originalContentId: qp("originalContentId"),
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
    if (q.originalContentId().trim())
      params.set("originalContentId", q.originalContentId().trim());
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
        "originalContentId",
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
      ocid: q.originalContentId(),
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
        originalContentId: s.ocid || undefined,
        createdFrom: s.cFrom || undefined,
        createdTo: s.cTo || undefined,
        updatedFrom: s.uFrom || undefined,
        updatedTo: s.uTo || undefined,
      })
  );

  const [sources, { refetch: refetchSources }] = createResource(fetchSources);

  const [visibleIds, setVisibleIds] = createSignal<string[]>([]);
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const [showBulkMeta, setShowBulkMeta] = createSignal(false);
  const [showBulkPath, setShowBulkPath] = createSignal(false);
  const [bulkBusy, setBulkBusy] = createSignal(false);
  const [bulkError, setBulkError] = createSignal<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const [sidebarVisible, setSidebarVisible] = createSignal(true);
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
    console.log("[DocsIndex] select all visible count=", ids.length);
    setSelectedIds(new Set(ids));
  };
  const handleSelectNone = () => {
    if (selectedIds().size === 0) return;
    console.log("[DocsIndex] select none");
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

  const handleDeleteSelected = async () => {
    const ids = visibleIds().filter((id) => selectedIds().has(id));
    const count = ids.length;
    if (!count) {
      alert("No selected visible notes to delete.");
      return;
    }
    if (!confirm(`Delete the ${count} selected notes? This cannot be undone.`))
      return;
    console.log("[DocsIndex] bulk delete selected ids count=", count);
    await bulkDeleteDocs(ids);
    // Remove deleted ids from selection
    setSelectedIds((prev) => {
      const s = new Set(prev);
      for (const id of ids) s.delete(id);
      return s;
    });
    await Promise.all([refetch(), refetchSources()]);
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
    }[]
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
      console.log("[DocsIndex] bulk meta ids count=", count, actions);
      await bulkUpdateMeta(ids, actions as any);
      await refetch();
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
      console.log("[DocsIndex] bulk set path ids count=", count, { path });
      await Promise.all(ids.map((id) => updateDocPath(id, path)));
      await refetch();
      setShowBulkPath(false);
    } catch (e) {
      setBulkError((e as Error).message || "Failed to update paths");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleScanRelativeImages = async () => {
    const pre = await scanRelativeImages({ dryRun: true });
    const count = Number(pre.matches || 0);
    if (!count) {
      alert("No notes found with relative image links.");
      return;
    }
    if (
      !confirm(
        `Mark ${count} notes with meta has_relative_image=true? This updates note metadata.`
      )
    )
      return;
    const res = await scanRelativeImages({});
    try {
      console.log("[DocsIndex] scan-relative-images", res);
    } catch {}
    await Promise.all([refetch(), refetchSources()]);
    alert(`Updated: ${res.updated ?? 0}, Failed: ${res.failed ?? 0}.`);
  };

  const handleSidebarDrawerChange = (details: { open?: boolean }) => {
    setSidebarOpen(details.open === true);
  };

  const handleOpenSidebar = () => setSidebarOpen(true);
  const handleToggleSidebar = () => setSidebarVisible((prev) => !prev);

  const sidebarToggleLabel = () =>
    sidebarVisible() ? "Hide Paths" : "Show Paths";

  return (
    <Box as="main" minH="100vh" bg="white">
      <Drawer.Root
        open={sidebarOpen()}
        onOpenChange={handleSidebarDrawerChange}
        placement="start"
        size="full"
      >
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content w="85vw" maxW="320px">
            <Drawer.CloseTrigger aria-label="Close paths">
              <CloseButton />
            </Drawer.CloseTrigger>
            <Box h="100dvh" minH="0">
              <PathTreeSidebar q={q} />
            </Box>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
      <Flex align="stretch" minH="100vh">
        <Show when={sidebarVisible()}>
          <>
            <Box
              display={{ base: "none", lg: "flex" }}
              w="16rem"
              flexShrink="0"
              bg="white"
              minH="100vh"
              borderRightWidth="1px"
              borderColor="gray.outline.border"
            >
              <Box
                position="sticky"
                top="3.5rem"
                h="calc(100vh - 3.5rem)"
                w="full"
              >
                <PathTreeSidebar q={q} />
              </Box>
            </Box>
          </>
        </Show>
        <Box flex="1" minW="0">
          <Container py="1.5rem" px="1rem" maxW="900px">
            <Stack gap="1rem">
              <Flex
                align="center"
                justify="space-between"
                gap="0.75rem"
                flexWrap="wrap"
              >
                <Heading as="h1" fontSize="2xl">
                  Notes
                </Heading>
                <HStack gap="0.5rem" flexWrap="wrap">
                  <Button
                    size="xs"
                    variant="outline"
                    display={{ base: "inline-flex", lg: "none" }}
                    onClick={handleOpenSidebar}
                  >
                    Paths
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    display={{ base: "none", lg: "inline-flex" }}
                    onClick={handleToggleSidebar}
                  >
                    {sidebarToggleLabel()}
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={visibleIds().length === 0}
                    onClick={handleSelectAllVisible}
                  >
                    Select All ({visibleIds().length})
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={selectedIds().size === 0}
                    onClick={handleSelectNone}
                  >
                    None
                  </Button>
                  <Button
                    size="xs"
                    colorPalette="red"
                    disabled={selectedVisibleCount() === 0}
                    onClick={handleDeleteSelected}
                  >
                    Delete ({selectedVisibleCount()})
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    disabled={selectedVisibleCount() === 0}
                    onClick={handleOpenBulkMeta}
                  >
                    Edit Meta
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    disabled={selectedVisibleCount() === 0}
                    onClick={handleOpenBulkPath}
                  >
                    Set Path
                  </Button>
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
                  serverResults={serverResults() || []}
                  serverLoading={serverLoading}
                  onVisibleIdsChange={setVisibleIds}
                  selectedIds={selectedIds()}
                  onToggleSelect={handleToggleSelect}
                />
              </Suspense>
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
        <Show when={sidebarVisible()}>
          <Box
            display={{ base: "none", lg: "block" }}
            w="16rem"
            flexShrink="0"
            aria-hidden="true"
          />
        </Show>
      </Flex>
    </Box>
  );
};

export default DocsIndexPage;
