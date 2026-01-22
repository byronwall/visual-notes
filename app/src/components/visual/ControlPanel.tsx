import {
  For,
  Show,
  createMemo,
  createSignal,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { useAction } from "@solidjs/router";
import { Box, Flex, Grid, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Checkbox from "~/components/ui/checkbox";
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
type LayoutMode = "umap" | "grid";

type SelectItem<T extends string> = SimpleSelectItem & { value: T };

const SORT_ITEMS: SelectItem<SortMode>[] = [
  { label: "Proximity (to mouse)", value: "proximity" },
  { label: "Title", value: "title" },
  { label: "Newest", value: "date" },
];

const LAYOUT_ITEMS: SelectItem<LayoutMode>[] = [
  { label: "UMAP (raw)", value: "umap" },
  { label: "Grid (Z-order)", value: "grid" },
];

export type ControlPanelProps = {
  docs: DocItem[] | undefined;
  positions: Accessor<Map<string, Point>>;
  mouseWorld: Accessor<{ x: number; y: number }>;
  hoveredId: Accessor<string | undefined>;
  showHoverLabel: Accessor<boolean>;
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
  onSelectDoc: (id: string) => void;
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
  const filteredAndSortedDocs = createMemo(() => {
    const list = props.docs || [];
    const q = props.searchQuery().trim().toLowerCase();
    const pos = props.positions();
    const m = props.mouseWorld();
    const sMode = props.sortMode();
    const filtered = q
      ? list.filter((d) => d.title.toLowerCase().includes(q))
      : list.slice();
    if (sMode === "title") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sMode === "date") {
      filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    } else {
      function d2(id: string) {
        const p = pos.get(id);
        if (!p) return Number.POSITIVE_INFINITY;
        const dx = p.x - m.x;
        const dy = p.y - m.y;
        return dx * dx + dy * dy;
      }
      filtered.sort((a, b) => d2(a.id) - d2(b.id));
    }
    return filtered;
  });

  // Selection action state
  const selectedCount = createMemo(
    () => props.selection?.selectedIds().size || 0
  );
  const [showMetaModal, setShowMetaModal] = createSignal(false);
  const [showPathModal, setShowPathModal] = createSignal(false);
  const [bulkBusy, setBulkBusy] = createSignal(false);
  const [bulkError, setBulkError] = createSignal<string | undefined>(undefined);
  const [bulkPathDraft, setBulkPathDraft] = createSignal("");
  const runUpdateDoc = useAction(updateDoc);

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
      console.log("[panel] bulk meta apply", { count: ids.length, record });
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
      console.log("[panel] bulk path apply", { count: ids.length, path });
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
      <Box p="3" borderBottomWidth="1px" borderColor="border">
        <Text fontSize="sm" fontWeight="medium" mb="2">
          Notes
        </Text>
        <HStack gap="2" mb="2">
          <Input
            size="sm"
            flex="1"
            minW="0"
            type="search"
            placeholder="Search titles…"
            value={props.searchQuery()}
            onInput={handleSearchInput}
          />
        </HStack>

        <Stack gap="3" mb="3">
          <Box>
            <Flex align="center" justify="space-between">
              <Text fontSize="xs" color="fg.muted">
                Path
              </Text>
            </Flex>
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
                  Blank only
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

        <Flex
          align="center"
          gap="2"
          flexWrap="wrap"
          fontSize="xs"
          color="fg.muted"
        >
          <SimpleSelect
            items={SORT_ITEMS}
            value={props.sortMode()}
            onChange={handleSortChange}
            label="Sort:"
            labelPlacement="inline"
            labelProps={{
              fontSize: "xs",
              color: "fg.muted",
              fontWeight: "normal",
            }}
            sameWidth
            triggerId="sortMode"
            minW="180px"
            placeholder="Sort"
          />

          <SimpleSelect
            items={LAYOUT_ITEMS}
            value={props.layoutMode()}
            onChange={handleLayoutChange}
            label="Layout:"
            labelPlacement="inline"
            labelProps={{
              fontSize: "xs",
              color: "fg.muted",
              fontWeight: "normal",
            }}
            sameWidth
            triggerId="layoutMode"
            minW="180px"
            placeholder="Layout"
            skipPortal
          />

          <Checkbox.Root
            checked={props.clusterUnknownTopCenter()}
            onCheckedChange={handleClusterUnknownChange}
          >
            <Checkbox.HiddenInput />
            <HStack gap="1">
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label fontSize="xs" color="fg.muted">
                Cluster unknown at top
              </Checkbox.Label>
            </HStack>
          </Checkbox.Root>

          <Checkbox.Root
            checked={props.nestByPath()}
            onCheckedChange={handleNestByPathChange}
          >
            <Checkbox.HiddenInput />
            <HStack gap="1">
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label fontSize="xs" color="fg.muted">
                Nest by path
              </Checkbox.Label>
            </HStack>
          </Checkbox.Root>

          <Checkbox.Root
            checked={props.hideNonMatches()}
            onCheckedChange={handleHideNonMatchesChange}
          >
            <Checkbox.HiddenInput />
            <HStack gap="1">
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label fontSize="xs" color="fg.muted">
                Hide non-matches
              </Checkbox.Label>
            </HStack>
          </Checkbox.Root>

          <Button
            size="xs"
            variant="outline"
            disabled={props.nudging()}
            onClick={() => props.onNudge(200)}
            title="Repel overlapping nodes a bit"
          >
            {props.nudging() ? "Nudging…" : "Nudge"}
          </Button>

          <Flex
            ml="auto"
            align="center"
            gap="2"
            flexWrap="wrap"
            justify="flex-end"
          >
            <Text fontSize="2xs" color="fg.muted" whiteSpace="nowrap">
              Zoom {props.scale().toFixed(2)}x
            </Text>
            <Text fontSize="2xs" color="gray.outline.border">
              ·
            </Text>
            <Text fontSize="2xs" color="fg.muted" whiteSpace="nowrap">
              {props.docs?.length || 0} notes
            </Text>
            <Show when={selectedCount() > 0}>
              <Text fontSize="2xs" color="gray.outline.border">
                ·
              </Text>
              <Text fontSize="2xs" color="fg.muted" whiteSpace="nowrap">
                {selectedCount()} selected
              </Text>
            </Show>
          </Flex>
        </Flex>

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

      <Box flex="1" overflowY="auto">
        <Show
          when={filteredAndSortedDocs().length > 0}
          fallback={
            <Box p="3">
              <Text fontSize="sm" color="fg.muted">
                No notes
              </Text>
            </Box>
          }
        >
          <Box as="ul">
            <For each={filteredAndSortedDocs().slice(0, 200)}>
              {(d) => {
                const p = createMemo(() => props.positions().get(d.id));
                const isHover = createMemo(
                  () => props.hoveredId() === d.id && props.showHoverLabel()
                );
                const distanceLabel = createMemo(() => {
                  const m = props.mouseWorld();
                  const pp = p();
                  if (!pp) return "";
                  const dx = pp.x - m.x;
                  const dy = pp.y - m.y;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(-dy, dx);
                  const arrows = ["→", "↗", "↑", "↖", "←", "↙", "↓", "↘"];
                  const idx =
                    ((Math.round((angle * 8) / (2 * Math.PI)) % 8) + 8) % 8;
                  const arrow = arrows[idx];
                  return `${Math.round(dist)}u ${arrow}`;
                });
                return (
                  <Box as="li">
                    <Button
                      variant="plain"
                      colorPalette="gray"
                      w="full"
                      justifyContent="flex-start"
                      textAlign="left"
                      px="3"
                      py="2"
                      gap="2"
                      bg={isHover() ? "gray.surface.bg.hover" : "transparent"}
                      _hover={{ bg: "gray.surface.bg.hover" }}
                      onClick={() => props.onSelectDoc(d.id)}
                      title={d.title}
                    >
                      <Box
                        flexShrink="0"
                        boxSize="10px"
                        borderRadius="full"
                        bg={
                          props.layoutMode() === "umap"
                            ? colorFor(d.path || d.title)
                            : colorFor(d.title)
                        }
                        style={{ border: "1px solid rgba(0,0,0,0.2)" }}
                      />
                      <Text
                        fontSize="sm"
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                      >
                        {d.title}
                      </Text>
                      <Text
                        ml="auto"
                        fontSize="10px"
                        color="fg.muted"
                        flexShrink="0"
                      >
                        {distanceLabel()}
                      </Text>
                    </Button>
                  </Box>
                );
              }}
            </For>
          </Box>
        </Show>
      </Box>

      <Box p="2" borderTopWidth="1px" borderColor="border">
        <Text fontSize="2xs" color="fg.muted">
          Drag to pan, wheel to zoom · Left pane sorts by mouse proximity
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
