import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { useAction } from "@solidjs/router";
import { ChevronDownIcon, ChevronRightIcon, SlidersHorizontalIcon } from "lucide-solid";
import { Box, Flex, Grid, HStack, Stack } from "styled-system/jsx";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import * as Checkbox from "~/components/ui/checkbox";
import * as Collapsible from "~/components/ui/collapsible";
import { Input } from "~/components/ui/input";
import type { SimpleSelectItem } from "~/components/ui/simple-select";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Text } from "~/components/ui/text";
import { colorFor } from "~/utils/colors";
import type { DocItem } from "~/types/notes";
import type { createSelectionStore } from "~/stores/selection.store";
import Modal from "~/components/Modal";
import { MetaKeyValueEditor } from "~/components/MetaKeyValueEditor";
import { PathEditor } from "~/components/PathEditor";
import { MetaKeySuggestions } from "~/components/MetaKeySuggestions";
import { MetaValueSuggestions } from "~/components/MetaValueSuggestions";
import {
  updateDoc,
  type MetaRecord,
} from "~/services/docs.service";

type Point = { x: number; y: number };

type SortMode = "proximity" | "title" | "date";
type LayoutMode = "umap" | "regions" | "grid" | "hex";

type SelectItem<T extends string> = SimpleSelectItem & { value: T };

const SORT_ITEMS: SelectItem<SortMode>[] = [
  { label: "Proximity (to mouse)", value: "proximity" },
  { label: "Title", value: "title" },
  { label: "Newest", value: "date" },
];

const LAYOUT_ITEMS: SelectItem<LayoutMode>[] = [
  { label: "Regions first", value: "regions" },
  { label: "UMAP (raw)", value: "umap" },
  { label: "Grid (Z-order)", value: "grid" },
  { label: "Hex cards", value: "hex" },
];

const CANVAS_SELECT_POSITIONING = {
  placement: "bottom-start",
  strategy: "fixed",
} as const;

export type ControlPanelProps = {
  docs: DocItem[] | undefined;
  positions: Accessor<Map<string, Point>>;
  navHeight: Accessor<number>;
  scale: Accessor<number>;
  searchQuery: Accessor<string>;
  setSearchQuery: (v: string) => void;
  hideNonMatches: Accessor<boolean>;
  setHideNonMatches: (v: boolean) => void;
  sortMode: Accessor<SortMode>;
  setSortMode: (m: SortMode) => void;
  nudging: Accessor<boolean>;
  onNudge: (iterations?: number) => void;
  layoutMode: Accessor<LayoutMode>;
  setLayoutMode: (m: LayoutMode) => void;
  clusterUnknownTopCenter: Accessor<boolean>;
  setClusterUnknownTopCenter: (v: boolean) => void;
  nestByPath: Accessor<boolean>;
  setNestByPath: (v: boolean) => void;
  selection?: ReturnType<typeof createSelectionStore>;
  // Filters
  pathPrefix: Accessor<string>;
  setPathPrefix: (v: string) => void;
  blankPathOnly: Accessor<boolean>;
  setBlankPathOnly: (v: boolean) => void;
  metaKey: Accessor<string>;
  setMetaKey: (v: string) => void;
  metaValue: Accessor<string>;
  setMetaValue: (v: string) => void;
  // TODO:TYPE_MIRROR, allow extra props for forward-compat without tightening here
  [key: string]: unknown;
};

export const ControlPanel: VoidComponent<ControlPanelProps> = (props) => {
  // Selection action state
  const selectedCount = createMemo(
    () => props.selection?.selectedIds().size || 0
  );
  const [showMetaModal, setShowMetaModal] = createSignal(false);
  const [showPathModal, setShowPathModal] = createSignal(false);
  const [bulkBusy, setBulkBusy] = createSignal(false);
  const [bulkError, setBulkError] = createSignal<string | undefined>(undefined);
  const [bulkPathDraft, setBulkPathDraft] = createSignal("");
  const hasActiveFilters = createMemo(
    () =>
      !!props.pathPrefix().trim() ||
      props.blankPathOnly() ||
      !!props.metaKey().trim() ||
      !!props.metaValue().trim()
  );
  const [showRefine, setShowRefine] = createSignal(hasActiveFilters());
  const runUpdateDoc = useAction(updateDoc);

  createEffect(() => {
    if (hasActiveFilters()) setShowRefine(true);
  });

  const handleIsolate = () => props.selection?.isolateSelection();
  const handleClearSelection = () => props.selection?.clearSelection();
  const handleOpenMeta = () => setShowMetaModal(true);
  const handleOpenPath = () => setShowPathModal(true);
  const handleCloseMeta = () => setShowMetaModal(false);
  const handleClosePath = () => setShowPathModal(false);
  const handlePopIso = () => props.selection?.popIsolation();
  const handleClearIso = () => props.selection?.clearIsolation();

  const handleApplyMeta = async (record: MetaRecord) => {
    const sel = props.selection;
    if (!sel) return;
    const ids = Array.from(sel.selectedIds());
    if (ids.length === 0) return;
    setBulkBusy(true);
    setBulkError(undefined);
    try {
      await Promise.all(ids.map((id) => runUpdateDoc({ id, meta: record })));
    } catch (e) {
      setBulkError((e as Error).message || "Failed to apply metadata");
    } finally {
      setBulkBusy(false);
      setShowMetaModal(false);
    }
  };

  const handleApplyPath = async (path: string) => {
    const sel = props.selection;
    if (!sel) return;
    const ids = Array.from(sel.selectedIds());
    if (ids.length === 0) return;
    setBulkBusy(true);
    setBulkError(undefined);
    try {
      await Promise.all(ids.map((id) => runUpdateDoc({ id, path })));
    } catch (e) {
      setBulkError((e as Error).message || "Failed to update paths");
    } finally {
      setBulkBusy(false);
      setShowPathModal(false);
    }
  };

  const handleSearchInput = (ev: Event) => {
    const target = ev.currentTarget as HTMLInputElement;
    props.setSearchQuery(target.value);
  };

  const handlePathChange = (p: string) => props.setPathPrefix(p);
  const handleBlankToggle = (details: {
    checked: boolean | "indeterminate";
  }) => {
    const checked = details.checked === true;
    props.setBlankPathOnly(checked);
    if (checked) props.setPathPrefix("");
  };
  const handleMetaKeyInput = (ev: Event) => {
    const target = ev.currentTarget as HTMLInputElement;
    props.setMetaKey(target.value);
  };
  const handleMetaValueInput = (ev: Event) => {
    const target = ev.currentTarget as HTMLInputElement;
    props.setMetaValue(target.value);
  };
  const clearMetaFilter = () => {
    props.setMetaKey("");
    props.setMetaValue("");
  };

  const handleSortChange = (value: string) => {
    if (!value) return;
    props.setSortMode(value as SortMode);
  };

  const handleLayoutChange = (value: string) => {
    if (!value) return;
    props.setLayoutMode(value as LayoutMode);
  };

  const handleClusterUnknownChange = (details: {
    checked: boolean | "indeterminate";
  }) => {
    props.setClusterUnknownTopCenter(details.checked === true);
  };

  const handleNestByPathChange = (details: {
    checked: boolean | "indeterminate";
  }) => {
    props.setNestByPath(details.checked === true);
  };

  const handleHideNonMatchesChange = (details: {
    checked: boolean | "indeterminate";
  }) => {
    props.setHideNonMatches(details.checked === true);
  };

  const layoutDescription = createMemo(() => {
    switch (props.layoutMode()) {
      case "hex":
        return "Card-based hex view with overlap control.";
      case "grid":
        return "Dense reordered grid based on UMAP proximity.";
      case "regions":
        return "Region-first view. Click a region to zoom into note-level detail.";
      default:
        return "Raw UMAP note positions.";
    }
  });

  return (
    <Box
      position="absolute"
      zIndex="10"
      borderRightWidth="1px"
      borderColor="border"
      boxShadow="md"
      overflowX="hidden"
      bg="bg.default"
      style={{
        top: `${props.navHeight()}px`,
        left: "0",
        width: "320px",
        bottom: "0",
        display: "flex",
        "flex-direction": "column",
        background: "rgba(255,255,255,0.95)",
        "backdrop-filter": "blur(10px)",
      }}
    >
      <Box
        p="3"
        borderBottomWidth="1px"
        borderColor="border"
        bg="bg.default"
        style={{
          position: "sticky",
          top: "0",
          "z-index": "1",
          background: "rgba(255,255,255,0.96)",
          "backdrop-filter": "blur(12px)",
        }}
      >
        <Stack gap="3">
          <Flex align="flex-start" justify="space-between" gap="3">
            <Stack gap="0.5">
              <Text fontSize="lg" fontWeight="semibold">
                Canvas
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Choose the view first, then refine the note set.
              </Text>
            </Stack>
            <Stack gap="1" align="flex-end">
              <Badge variant="subtle" colorPalette="gray">
                {props.docs?.length || 0} notes
              </Badge>
              <Text fontSize="2xs" color="fg.muted" whiteSpace="nowrap">
                Zoom {props.scale().toFixed(2)}x
              </Text>
            </Stack>
          </Flex>

          <Input
            size="sm"
            type="search"
            placeholder="Search titles…"
            value={props.searchQuery()}
            onInput={handleSearchInput}
          />

          <Box
            bg="bg.subtle"
            borderRadius="l3"
            p="3"
            borderWidth="1px"
            borderColor="border"
          >
            <Stack gap="3">
              <Box>
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Canvas view
                </Text>
                <SimpleSelect
                  items={LAYOUT_ITEMS}
                  value={props.layoutMode()}
                  onChange={handleLayoutChange}
                  positioning={CANVAS_SELECT_POSITIONING}
                  triggerId="layoutMode"
                  placeholder="Layout"
                  skipPortal={false}
                />
                <Text fontSize="2xs" color="fg.muted" mt="1.5">
                  {layoutDescription()}
                </Text>
              </Box>

              <Grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="2">
                <Box>
                  <Text fontSize="xs" color="fg.muted" mb="1">
                    Sort note list
                  </Text>
                  <SimpleSelect
                    items={SORT_ITEMS}
                    value={props.sortMode()}
                    onChange={handleSortChange}
                    positioning={CANVAS_SELECT_POSITIONING}
                    triggerId="sortMode"
                    placeholder="Sort"
                    skipPortal={false}
                  />
                </Box>
                <Box>
                  <Text fontSize="xs" color="fg.muted" mb="1">
                    Actions
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    w="full"
                    disabled={props.nudging()}
                    onClick={() => props.onNudge(200)}
                    title="Repel overlapping nodes a bit"
                  >
                    {props.nudging() ? "Nudging…" : "Nudge layout"}
                  </Button>
                </Box>
              </Grid>

              <Grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="2">
                <Checkbox.Root
                  checked={props.hideNonMatches()}
                  onCheckedChange={handleHideNonMatchesChange}
                >
                  <Checkbox.HiddenInput />
                  <HStack
                    gap="2"
                    bg="bg.default"
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="l2"
                    px="2.5"
                    py="2"
                    minH="12"
                  >
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label fontSize="xs" color="fg.default">
                      Hide non-matches
                    </Checkbox.Label>
                  </HStack>
                </Checkbox.Root>

                <Checkbox.Root
                  checked={props.clusterUnknownTopCenter()}
                  onCheckedChange={handleClusterUnknownChange}
                >
                  <Checkbox.HiddenInput />
                  <HStack
                    gap="2"
                    bg="bg.default"
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="l2"
                    px="2.5"
                    py="2"
                    minH="12"
                  >
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label fontSize="xs" color="fg.default">
                      Cluster unknown
                    </Checkbox.Label>
                  </HStack>
                </Checkbox.Root>

                <Checkbox.Root
                  checked={props.nestByPath()}
                  onCheckedChange={handleNestByPathChange}
                >
                  <Checkbox.HiddenInput />
                  <HStack
                    gap="2"
                    bg="bg.default"
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="l2"
                    px="2.5"
                    py="2"
                    minH="12"
                  >
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label fontSize="xs" color="fg.default">
                      Nest by path
                    </Checkbox.Label>
                  </HStack>
                </Checkbox.Root>

                <Flex
                  align="center"
                  justify="center"
                  bg="bg.default"
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="l2"
                  minH="12"
                  px="2.5"
                >
                  <Text fontSize="2xs" color="fg.muted" textAlign="center">
                    Shift-drag to select notes
                  </Text>
                </Flex>
              </Grid>
            </Stack>
          </Box>

          <Collapsible.Root
            open={showRefine()}
            onOpenChange={(details) => setShowRefine(details.open)}
          >
            <Stack gap="2">
              <Collapsible.Trigger
                asChild={(triggerProps) => (
                  <Button
                    {...triggerProps()}
                    type="button"
                    variant="plain"
                    justifyContent="space-between"
                    px="0"
                    colorPalette="gray"
                  >
                    <HStack gap="2">
                      <SlidersHorizontalIcon size={15} />
                      <span>Refine notes</span>
                      <Show when={hasActiveFilters()}>
                        <Badge size="sm" variant="subtle" colorPalette="blue">
                          Active
                        </Badge>
                      </Show>
                    </HStack>
                    <Show
                      when={showRefine()}
                      fallback={<ChevronRightIcon size={16} />}
                    >
                      <ChevronDownIcon size={16} />
                    </Show>
                  </Button>
                )}
              />

              <Collapsible.Content>
                <Stack
                  gap="3"
                  pt="1"
                  bg="bg.subtle"
                  borderRadius="l3"
                  p="3"
                  borderWidth="1px"
                  borderColor="border"
                >
                  <Box>
                    <Text fontSize="xs" color="fg.muted" mb="1">
                      Path
                    </Text>
                    <Box
                      opacity={props.blankPathOnly() ? 0.6 : 1}
                      pointerEvents={props.blankPathOnly() ? "none" : "auto"}
                    >
                      <PathEditor
                        initialPath={props.pathPrefix()}
                        onChange={handlePathChange}
                      />
                    </Box>
                    <Checkbox.Root
                      checked={props.blankPathOnly()}
                      onCheckedChange={handleBlankToggle}
                    >
                      <Checkbox.HiddenInput />
                      <HStack gap="1" mt="2">
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Checkbox.Label fontSize="xs" color="fg.muted">
                          Blank path only
                        </Checkbox.Label>
                      </HStack>
                    </Checkbox.Root>
                  </Box>

                  <Box>
                    <Flex align="center" justify="space-between" mb="1">
                      <Text fontSize="xs" color="fg.muted">
                        Meta
                      </Text>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={clearMetaFilter}
                        title="Clear meta filter"
                        type="button"
                      >
                        Clear
                      </Button>
                    </Flex>
                    <Grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="2">
                      <Input
                        size="sm"
                        placeholder="key"
                        value={props.metaKey()}
                        onInput={handleMetaKeyInput}
                      />
                      <Input
                        size="sm"
                        placeholder="value"
                        value={props.metaValue()}
                        onInput={handleMetaValueInput}
                      />
                    </Grid>
                    <Box mt="2">
                      <MetaKeySuggestions
                        onSelect={(k) => props.setMetaKey(k)}
                        limit={8}
                      />
                      <MetaValueSuggestions
                        keyName={props.metaKey()}
                        onSelect={(v) => props.setMetaValue(v)}
                        limit={8}
                      />
                    </Box>
                  </Box>
                </Stack>
              </Collapsible.Content>
            </Stack>
          </Collapsible.Root>
        </Stack>

        <Show when={(props.selection?.breadcrumbs().length || 0) > 0}>
          <HStack gap="1" mb="2" flexWrap="wrap">
            <For each={props.selection?.breadcrumbs() || []}>
              {(c, i) => (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => props.selection?.popIsolationTo(i())}
                >
                  {c.label || `Level ${i() + 1}`} ({c.ids.length})
                </Button>
              )}
            </For>
            <Button size="xs" variant="outline" onClick={handlePopIso}>
              Back
            </Button>
            <Button size="xs" variant="outline" onClick={handleClearIso}>
              Clear
            </Button>
          </HStack>
        </Show>

        <Show when={selectedCount() > 0}>
          <HStack gap="2" mt="2" flexWrap="wrap">
            <Button size="xs" variant="outline" onClick={handleIsolate}>
              Isolate
            </Button>
            <Button size="xs" variant="outline" onClick={handleOpenMeta}>
              Tag (meta)
            </Button>
            <Button size="xs" variant="outline" onClick={handleOpenPath}>
              Bulk Path
            </Button>
            <Button size="xs" variant="outline" onClick={handleClearSelection}>
              Clear Sel
            </Button>
          </HStack>
        </Show>
      </Box>

      <Box flex="1" overflowY="auto" p="3">
        <Box
          bg="bg.subtle"
          borderRadius="l3"
          borderWidth="1px"
          borderColor="border"
          p="3"
        >
          <Stack gap="1.5">
            <Text fontSize="sm" fontWeight="medium">
              Canvas focus
            </Text>
            <Text fontSize="xs" color="fg.muted">
              Region navigation is now handled directly on the canvas. Hover regions for context and click to zoom into note-level detail.
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {props.docs?.length || 0} notes match the current search and refine filters.
            </Text>
          </Stack>
        </Box>
      </Box>

      <Box p="2" borderTopWidth="1px" borderColor="border" bg="bg.default">
        <Text fontSize="2xs" color="fg.muted">
          Drag to pan, wheel to zoom. Layout changes affect the canvas, not the note list.
        </Text>
      </Box>

      <Modal open={showMetaModal()} onClose={handleCloseMeta}>
        <Box p="3">
          <Text fontSize="sm" fontWeight="medium" mb="2">
            Apply metadata to selection
          </Text>
          <Show when={!!bulkError()}>
            <Text fontSize="xs" color="error" mb="2">
              {bulkError()}
            </Text>
          </Show>
          <MetaKeyValueEditor
            onChange={(rec) => {
              if (bulkBusy()) return;
              void handleApplyMeta(rec);
            }}
          />
        </Box>
      </Modal>

      <Modal open={showPathModal()} onClose={handleClosePath}>
        <Box p="3">
          <Text fontSize="sm" fontWeight="medium" mb="2">
            Set path for selection
          </Text>
          <Show when={!!bulkError()}>
            <Text fontSize="xs" color="error" mb="2">
              {bulkError()}
            </Text>
          </Show>
          <Box mb="3">
            <PathEditor onChange={(path) => setBulkPathDraft(path)} />
          </Box>
          <Flex justify="flex-end" gap="2">
            <Button size="xs" variant="outline" onClick={handleClosePath}>
              Cancel
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={bulkBusy()}
              onClick={() => {
                const v = bulkPathDraft().trim();
                if (!v) return;
                void handleApplyPath(v);
              }}
            >
              Apply to {selectedCount()} items
            </Button>
          </Flex>
        </Box>
      </Modal>
    </Box>
  );
};
