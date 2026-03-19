import { useAction } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { createPanZoomHandlers } from "~/hooks/usePanZoom";
import { createCanvasStore } from "~/stores/canvas.store";
import { toaster } from "~/components/ui/toast";
import { updateArchivedPageCanvasState } from "~/services/archive/archive.actions";
import type {
  ArchivedPageCanvasCardMode,
  ArchivedPageCanvasItem,
} from "~/services/archive/archive.types";
import { ArchiveCanvasCard } from "./ArchiveCanvasCard";

type Props = {
  groupName: string;
  items: ArchivedPageCanvasItem[];
  toolbarPrefix?: JSX.Element;
};

type CanvasNodeState = {
  x: number;
  y: number;
  mode: ArchivedPageCanvasCardMode;
};

function roundPosition(value: number) {
  return Math.round(value * 100) / 100;
}

export const ArchiveGroupCanvas = (props: Props) => {
  const canvasStore = createCanvasStore();
  const runUpdateArchivedPageCanvasState = useAction(updateArchivedPageCanvasState);
  const [nodes, setNodes] = createStore<Record<string, CanvasNodeState>>({});
  const [didInitialFit, setDidInitialFit] = createSignal(false);
  const [draggingId, setDraggingId] = createSignal<string>();
  let canvasViewportRef: HTMLDivElement | undefined;
  let transformLayerRef: HTMLDivElement | undefined;

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
    const padding = 240;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const item of items) {
      minX = Math.min(minX, item.canvasX);
      minY = Math.min(minY, item.canvasY);
      maxX = Math.max(maxX, item.canvasX + 320);
      maxY = Math.max(maxY, item.canvasY + 260);
    }

    const contentWidth = Math.max(320, maxX - minX + padding);
    const contentHeight = Math.max(280, maxY - minY + padding);
    const scale = Math.max(
      0.28,
      Math.min(1.15, 0.92 * Math.min(usableWidth / contentWidth, usableHeight / contentHeight)),
    );

    canvasStore.setScale(scale);
    canvasStore.setOffset({
      x: usableWidth / 2 - ((minX + maxX) / 2) * scale,
      y: usableHeight / 2 - ((minY + maxY) / 2) * scale,
    });
    canvasStore.scheduleTransform();
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
  });

  createEffect(() => {
    itemsWithState();
    if (didInitialFit()) return;
    if (!props.items.length) return;
    fitToContent();
    setDidInitialFit(true);
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
      if (event.key.toLowerCase() !== "f") return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      fitToContent();
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

  const handleModeChange = async (
    id: string,
    mode: ArchivedPageCanvasCardMode,
  ) => {
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

  return (
    <Stack gap="3" h="full" minH="0">
      <HStack
        justify="space-between"
        alignItems="center"
        gap="2"
        flexShrink="0"
        minW="0"
      >
        <HStack gap="3" minW="0" flex="1" overflow="hidden">
          {props.toolbarPrefix}
          <HStack gap="2" minW="0" overflow="hidden">
            <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="semibold" lineClamp="1">
              {props.groupName}
            </Text>
            <Text color="fg.muted" fontSize="sm" lineClamp="1" hideBelow="md">
              Drag cards to organize the group.
            </Text>
          </HStack>
        </HStack>

        <HStack gap="2">
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
          <For each={itemsWithState()}>
            {(item) => (
              <Box
                position="absolute"
                style={{
                  transform: `translate(${item.canvasX}px, ${item.canvasY}px)`,
                }}
              >
                <ArchiveCanvasCard
                  item={item}
                  isDragging={draggingId() === item.id}
                  onDragStart={(event) => beginCardDrag(event, item.id)}
                  onModeChange={(mode) => void handleModeChange(item.id, mode)}
                />
              </Box>
            )}
          </For>
        </Box>
      </Box>
    </Stack>
  );
};
