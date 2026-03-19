import { revalidate, useAction } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  type JSX,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { Box, HStack, Stack } from "styled-system/jsx";
import { ArchiveDetailDrawer } from "~/components/archive/ArchiveDetailDrawer";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { createPanZoomHandlers } from "~/hooks/usePanZoom";
import { toaster } from "~/components/ui/toast";
import {
  saveArchiveGroupCanvasLayout,
  updateArchivedPageCanvasState,
} from "~/services/archive/archive.actions";
import { fetchArchiveGroupCanvasItems } from "~/services/archive/archive.service";
import type {
  ArchivedPageCanvasCardMode,
  ArchivedPageCanvasItem,
} from "~/services/archive/archive.types";
import { createCanvasStore } from "~/stores/canvas.store";
import { ArchiveCanvasCard } from "./ArchiveCanvasCard";

type Props = {
  groupName: string;
  items: ArchivedPageCanvasItem[];
  groupOptions: string[];
  toolbarPrefix?: JSX.Element;
};

type CanvasNodeState = {
  x: number;
  y: number;
  mode: ArchivedPageCanvasCardMode;
};

type CardMeasurement = {
  width: number;
  height: number;
};

const CARD_WIDTH = 320;
const CARD_HEIGHT = 280;
const GRID_GAP_X = 56;
const GRID_GAP_Y = 48;
const GRID_ROW_BUFFER = 12;

function roundPosition(value: number) {
  return Math.round(value * 100) / 100;
}

function measureCard(element: HTMLDivElement | undefined): CardMeasurement {
  const rect = element?.getBoundingClientRect();
  const width = Math.max(
    CARD_WIDTH,
    Math.ceil(rect?.width ?? 0),
    Math.ceil(element?.offsetWidth ?? 0),
    Math.ceil(element?.scrollWidth ?? 0),
  );
  const height = Math.max(
    CARD_HEIGHT,
    Math.ceil(rect?.height ?? 0),
    Math.ceil(element?.offsetHeight ?? 0),
    Math.ceil(element?.scrollHeight ?? 0),
  );

  return { width, height };
}

function buildGridLayout(args: {
  items: ArchivedPageCanvasItem[];
  measurements: Record<string, CardMeasurement>;
  viewportWidth: number;
}) {
  const items = args.items;
  const firstMeasurement = items[0] ? args.measurements[items[0].id] : undefined;
  const columnWidth = Math.max(CARD_WIDTH, firstMeasurement?.width ?? CARD_WIDTH);
  const usableWidth = Math.max(columnWidth, args.viewportWidth - 160);
  const columns = Math.max(
    1,
    Math.min(items.length, Math.floor((usableWidth + GRID_GAP_X) / (columnWidth + GRID_GAP_X))),
  );
  const rows = Math.max(1, Math.ceil(items.length / columns));
  const totalWidth = columns * columnWidth + Math.max(0, columns - 1) * GRID_GAP_X;
  const rowHeights = Array.from({ length: rows }, (_, rowIndex) =>
    Math.max(
      ...items
        .slice(rowIndex * columns, rowIndex * columns + columns)
        .map((item) => args.measurements[item.id]?.height ?? CARD_HEIGHT),
      CARD_HEIGHT,
    ) + GRID_ROW_BUFFER,
  );
  const totalHeight =
    rowHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, rows - 1) * GRID_GAP_Y;
  const originX = -totalWidth / 2;
  const originY = -totalHeight / 2;

  const rowOffsets = rowHeights.map((_, index) => {
    const previousHeight = rowHeights.slice(0, index).reduce((sum, height) => sum + height, 0);
    return originY + previousHeight + index * GRID_GAP_Y;
  });

  return Object.fromEntries(
    items.map((item, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      return [
        item.id,
        {
          x: originX + column * (columnWidth + GRID_GAP_X),
          y: rowOffsets[row] ?? originY,
          mode: item.canvasCardMode,
        } satisfies CanvasNodeState,
      ];
    }),
  );
}

export const ArchiveGroupCanvas = (props: Props) => {
  const canvasStore = createCanvasStore();
  const runUpdateArchivedPageCanvasState = useAction(updateArchivedPageCanvasState);
  const runSaveArchiveGroupCanvasLayout = useAction(saveArchiveGroupCanvasLayout);

  const [nodes, setNodes] = createStore<Record<string, CanvasNodeState>>({});
  const [didInitialFit, setDidInitialFit] = createSignal(false);
  const [didSeedInitialPositions, setDidSeedInitialPositions] = createSignal(false);
  const [draggingId, setDraggingId] = createSignal<string>();
  const [activeId, setActiveId] = createSignal<string>();
  const [selectedId, setSelectedId] = createSignal<string>();
  let canvasViewportRef: HTMLDivElement | undefined;
  let transformLayerRef: HTMLDivElement | undefined;
  const cardElements = new Map<string, HTMLDivElement>();

  const panZoomHandlers = createPanZoomHandlers(canvasStore);

  const itemsWithState = createMemo(() =>
    props.items.map((item) => {
      const node = nodes[item.id];
      return {
        ...item,
        canvasX: node?.x ?? item.canvasX,
        canvasY: node?.y ?? item.canvasY,
        canvasCardMode: node?.mode ?? item.canvasCardMode,
      };
    }),
  );

  const activeItemIds = createMemo(() => {
    const ids = itemsWithState().map((item) => item.id).filter((id) => id !== activeId());
    if (activeId()) ids.push(activeId()!);
    return ids;
  });

  const itemsById = createMemo(
    () => new Map(itemsWithState().map((item) => [item.id, item] as const)),
  );

  const measureNav = () => {
    const nav = document.querySelector("main nav");
    const height =
      nav instanceof HTMLElement ? Math.round(nav.getBoundingClientRect().height) : 0;
    canvasStore.setNavHeight(height);
  };

  const measureViewport = () => {
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    }
    const rect = main.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    };
  };

  const fitToContent = () => {
    const items = itemsWithState();
    if (!items.length) return;

    const viewportSnapshot = measureViewport();
    const navHeight = canvasStore.navHeight();
    const usableWidth = Math.max(320, viewportSnapshot.width);
    const usableHeight = Math.max(240, viewportSnapshot.height - navHeight);
    const padding = 260;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const item of items) {
      minX = Math.min(minX, item.canvasX);
      minY = Math.min(minY, item.canvasY);
      maxX = Math.max(maxX, item.canvasX + CARD_WIDTH);
      maxY = Math.max(maxY, item.canvasY + CARD_HEIGHT);
    }

    const contentWidth = Math.max(320, maxX - minX + padding);
    const contentHeight = Math.max(280, maxY - minY + padding);
    const scale = Math.max(
      0.2,
      Math.min(1.15, 0.92 * Math.min(usableWidth / contentWidth, usableHeight / contentHeight)),
    );

    canvasStore.animateToView({
      scale,
      offset: {
        x: usableWidth / 2 - ((minX + maxX) / 2) * scale,
        y: usableHeight / 2 - ((minY + maxY) / 2) * scale,
      },
      durationMs: 220,
    });
  };

  const persistLayout = async (
    nextItems: Array<{ id: string; x: number; y: number; mode: ArchivedPageCanvasCardMode }>,
    options?: { successTitle?: string },
  ) => {
    try {
      await runSaveArchiveGroupCanvasLayout({
        items: nextItems.map((item) => ({
          id: item.id,
          canvasX: roundPosition(item.x),
          canvasY: roundPosition(item.y),
          canvasCardMode: item.mode,
        })),
      });
      await revalidate(fetchArchiveGroupCanvasItems.keyFor(props.groupName));
      if (options?.successTitle) {
        toaster.create({
          type: "success",
          title: options.successTitle,
        });
      }
    } catch (error) {
      console.error("[archive-canvas] failed to persist layout", error);
      toaster.create({
        type: "error",
        title: "Could not save canvas layout",
        description: error instanceof Error ? error.message : "Archive layout update failed.",
      });
    }
  };

  createEffect(() => {
    const nextEntries = Object.fromEntries(
      props.items.map((item) => [
        item.id,
        {
          x: item.canvasX,
          y: item.canvasY,
          mode: item.canvasCardMode,
        },
      ]),
    );
    setNodes(reconcile(nextEntries));
  });

  createEffect(() => {
    props.groupName;
    setDidInitialFit(false);
    setDidSeedInitialPositions(false);
    setSelectedId(undefined);
    setActiveId(undefined);
  });

  createEffect(() => {
    itemsWithState();
    if (didInitialFit()) return;
    if (!props.items.length) return;
    fitToContent();
    setDidInitialFit(true);
  });

  createEffect(() => {
    if (didSeedInitialPositions()) return;
    const missing = props.items.filter((item) => !item.hasPersistedPosition);
    if (!missing.length) {
      setDidSeedInitialPositions(true);
      return;
    }

    setDidSeedInitialPositions(true);
    const seededItems = missing
      .map((item) => {
        const node = nodes[item.id];
        if (!node) return null;
        return {
          id: item.id,
          x: node.x,
          y: node.y,
          mode: node.mode,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (!seededItems.length) return;
    void persistLayout(seededItems);
  });

  createEffect(() => {
    const layer = transformLayerRef;
    if (!layer) return;
    layer.style.transform = canvasStore.viewTransform();
    layer.style.transformOrigin = "0 0";
  });

  onMount(() => {
    measureNav();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        fitToContent();
        return;
      }

      if (event.key.toLowerCase() === "g") {
        event.preventDefault();
        void arrangeGrid();
      }
    };

    const handleResize = () => {
      measureNav();
      fitToContent();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    });
  });

  const persistNodeState = async (
    id: string,
    next: { x: number; y: number; mode: ArchivedPageCanvasCardMode },
  ) => {
    try {
      await runUpdateArchivedPageCanvasState({
        id,
        canvasX: roundPosition(next.x),
        canvasY: roundPosition(next.y),
        canvasCardMode: next.mode,
      });
      await revalidate(fetchArchiveGroupCanvasItems.keyFor(props.groupName));
    } catch (error) {
      console.error("[archive-canvas] failed to persist node state", {
        id,
        error,
      });
      toaster.create({
        type: "error",
        title: "Could not save card layout",
        description:
          error instanceof Error ? error.message : "Archive layout update failed.",
      });
    }
  };

  const handleModeChange = async (id: string, mode: ArchivedPageCanvasCardMode) => {
    const current = nodes[id];
    if (!current || current.mode === mode) return;
    setNodes(id, "mode", mode);
    await persistNodeState(id, { ...current, mode });
  };

  const beginCardDrag = (event: PointerEvent, itemId: string) => {
    event.stopPropagation();
    event.preventDefault();

    const currentTarget = event.currentTarget;
    if (!(currentTarget instanceof HTMLElement)) return;

    const origin = nodes[itemId];
    if (!origin) return;

    const screenToCanvas = (clientX: number, clientY: number) => {
      const viewportRect = canvasViewportRef?.getBoundingClientRect();
      const viewOffset = canvasStore.offset();
      const viewScale = canvasStore.scale();
      const localX = clientX - (viewportRect?.left ?? 0);
      const localY = clientY - (viewportRect?.top ?? 0);
      return {
        x: (localX - viewOffset.x) / viewScale,
        y: (localY - viewOffset.y) / viewScale,
      };
    };

    try {
      currentTarget.setPointerCapture(event.pointerId);
    } catch (_) {}

    setActiveId(itemId);
    setDraggingId(itemId);
    let latest = origin;
    const startCanvasPoint = screenToCanvas(event.clientX, event.clientY);
    const dragOffset = {
      x: startCanvasPoint.x - origin.x,
      y: startCanvasPoint.y - origin.y,
    };

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== event.pointerId) return;
      const nextCanvasPoint = screenToCanvas(moveEvent.clientX, moveEvent.clientY);
      latest = {
        x: nextCanvasPoint.x - dragOffset.x,
        y: nextCanvasPoint.y - dragOffset.y,
        mode: latest.mode,
      };
      setNodes(itemId, {
        x: latest.x,
        y: latest.y,
        mode: latest.mode,
      });
    };

    const finish = async (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== event.pointerId) return;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      try {
        currentTarget.releasePointerCapture(event.pointerId);
      } catch (_) {}
      setDraggingId((value) => (value === itemId ? undefined : value));
      await persistNodeState(itemId, latest);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const arrangeGrid = async () => {
    const measurements = Object.fromEntries(
      itemsWithState().map((item) => {
        const element = cardElements.get(item.id);
        return [
          item.id,
          measureCard(element),
        ];
      }),
    );
    const nextLayout = buildGridLayout({
      items: itemsWithState(),
      measurements,
      viewportWidth: measureViewport().width,
    });
    setNodes(reconcile(nextLayout));
    await persistLayout(
      Object.entries(nextLayout).map(([id, layout]) => ({
        id,
        x: layout.x,
        y: layout.y,
        mode: layout.mode,
      })),
      { successTitle: "Saved grid arrangement" },
    );
    fitToContent();
  };

  return (
    <>
      <Stack gap="3" h="full" minH="0">
        <HStack
          justify="space-between"
          alignItems="center"
          gap="2"
          flexShrink="0"
          minW="0"
          flexWrap="wrap"
        >
          <HStack gap="3" minW="0" flex="1" overflow="hidden" flexWrap="wrap">
            {props.toolbarPrefix}
            <HStack gap="2" minW="0" overflow="hidden">
              <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="semibold" lineClamp="1">
                {props.groupName}
              </Text>
              <Text color="fg.muted" fontSize="sm" lineClamp="1" hideBelow="md">
                Drag any header to organize, or drop into a saved grid.
              </Text>
            </HStack>
          </HStack>

          <HStack gap="2" flexWrap="wrap">
            <Button type="button" variant="outline" onClick={() => void arrangeGrid()}>
              Arrange grid (G)
            </Button>
            <Button type="button" variant="outline" onClick={fitToContent}>
              Fit view (F)
            </Button>
          </HStack>
        </HStack>

        <Box
          position="relative"
          flex="1"
          minH="0"
          borderRadius="l3"
          borderWidth="1px"
          borderColor="border"
          overflow="hidden"
          bg="bg.default"
          style={{
            "touch-action": "none",
            "background-image":
              "linear-gradient(to right, rgba(80,80,80,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(80,80,80,0.035) 1px, transparent 1px)",
            "background-size": "32px 32px",
            cursor: canvasStore.isPanning() ? "grabbing" : "grab",
          }}
          onWheel={panZoomHandlers.onWheel}
          onPointerDown={panZoomHandlers.onPointerDown}
          onPointerMove={panZoomHandlers.onPointerMove}
          onPointerUp={panZoomHandlers.onPointerUp}
          onPointerLeave={panZoomHandlers.onPointerLeave}
          ref={canvasViewportRef}
        >
          <Box
            position="absolute"
            left="0"
            top="0"
            w="full"
            h="full"
            ref={transformLayerRef}
          >
            <For each={activeItemIds()}>
              {(itemId, index) => {
                const item = () => itemsById().get(itemId);
                return (
                  <Show when={item()}>
                    {(current) => (
                      <Box
                        position="absolute"
                        zIndex={itemId === activeId() ? 40 : 10 + index()}
                        style={{
                          transform: `translate(${current().canvasX}px, ${current().canvasY}px)`,
                        }}
                      >
                        <ArchiveCanvasCard
                          item={current()}
                          isActive={itemId === activeId()}
                          isDragging={draggingId() === itemId}
                          cardRef={(element) => {
                            if (element) {
                              cardElements.set(itemId, element);
                              return;
                            }
                            cardElements.delete(itemId);
                          }}
                          onActivate={() => setActiveId(itemId)}
                          onDragStart={(event) => beginCardDrag(event, itemId)}
                          onModeChange={(mode) => void handleModeChange(itemId, mode)}
                          onOpenDetails={() => setSelectedId(itemId)}
                        />
                      </Box>
                    )}
                  </Show>
                );
              }}
            </For>
          </Box>
        </Box>
      </Stack>

      <ArchiveDetailDrawer
        open={Boolean(selectedId())}
        pageId={selectedId()}
        groupOptions={props.groupOptions}
        onClose={() => setSelectedId(undefined)}
        onChanged={() => void revalidate(fetchArchiveGroupCanvasItems.keyFor(props.groupName))}
        onDeleted={(pageId) => {
          if (selectedId() === pageId) setSelectedId(undefined);
          void revalidate(fetchArchiveGroupCanvasItems.keyFor(props.groupName));
        }}
      />
    </>
  );
};
