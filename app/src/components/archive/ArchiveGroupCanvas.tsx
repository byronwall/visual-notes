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
import { ArchiveCanvasFreeformCard } from "~/components/archive/ArchiveCanvasFreeformCard";
import { ArchiveDetailDrawer } from "~/components/archive/ArchiveDetailDrawer";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { createPanZoomHandlers } from "~/hooks/usePanZoom";
import { toaster } from "~/components/ui/toast";
import {
  createArchiveCanvasNode,
  deleteArchiveCanvasNode,
  saveArchiveGroupCanvasLayout,
  updateArchiveCanvasNode,
  updateArchiveCanvasNodeState,
  updateArchivedPageCanvasState,
} from "~/services/archive/archive.actions";
import { fetchArchiveGroupCanvasItems } from "~/services/archive/archive.service";
import type {
  ArchiveGroupCanvasItem,
  ArchivedCanvasNodeItem,
  ArchivedPageCanvasCardMode,
  ArchivedPageCanvasItem,
} from "~/services/archive/archive.types";
import { createCanvasStore } from "~/stores/canvas.store";
import { ArchiveCanvasCard } from "./ArchiveCanvasCard";

type Props = {
  groupName: string;
  items: ArchiveGroupCanvasItem[];
  groupOptions: string[];
  toolbarPrefix?: JSX.Element;
};

type CanvasNodeState = {
  x: number;
  y: number;
  mode?: ArchivedPageCanvasCardMode;
  width?: number;
  height?: number;
};

type CardMeasurement = {
  width: number;
  height: number;
};

type ResizeDirection = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

const CARD_WIDTH = 320;
const CARD_HEIGHT = 280;
const NOTE_NODE_WIDTH = 420;
const NOTE_NODE_HEIGHT = 300;
const IMAGE_NODE_WIDTH = 360;
const IMAGE_NODE_HEIGHT = 280;
const MIN_NOTE_NODE_WIDTH = 280;
const MIN_NOTE_NODE_HEIGHT = 180;
const MIN_IMAGE_NODE_WIDTH = 180;
const MIN_IMAGE_NODE_HEIGHT = 140;
const MAX_NODE_WIDTH = 1200;
const MAX_NODE_HEIGHT = 960;
const GRID_GAP_X = 56;
const GRID_GAP_Y = 48;
const GRID_ROW_BUFFER = 12;

function roundPosition(value: number) {
  return Math.round(value * 100) / 100;
}

function clampNodeSize(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getDefaultNodeSize(kind: ArchivedCanvasNodeItem["kind"]) {
  return kind === "note"
    ? { width: NOTE_NODE_WIDTH, height: NOTE_NODE_HEIGHT }
    : { width: IMAGE_NODE_WIDTH, height: IMAGE_NODE_HEIGHT };
}

function getMinNodeSize(kind: ArchivedCanvasNodeItem["kind"]) {
  return kind === "note"
    ? { width: MIN_NOTE_NODE_WIDTH, height: MIN_NOTE_NODE_HEIGHT }
    : { width: MIN_IMAGE_NODE_WIDTH, height: MIN_IMAGE_NODE_HEIGHT };
}

function getResizeCursor(direction: ResizeDirection) {
  switch (direction) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "nw":
    case "se":
    default:
      return "nwse-resize";
  }
}

function measureCard(
  element: HTMLDivElement | undefined,
  fallback?: Partial<CardMeasurement>,
): CardMeasurement {
  const rect = element?.getBoundingClientRect();
  const width = Math.max(
    fallback?.width ?? CARD_WIDTH,
    Math.ceil(rect?.width ?? 0),
    Math.ceil(element?.offsetWidth ?? 0),
    Math.ceil(element?.scrollWidth ?? 0),
  );
  const height = Math.max(
    fallback?.height ?? CARD_HEIGHT,
    Math.ceil(rect?.height ?? 0),
    Math.ceil(element?.offsetHeight ?? 0),
    Math.ceil(element?.scrollHeight ?? 0),
  );

  return { width, height };
}

function buildGridLayout(args: {
  items: ArchiveGroupCanvasItem[];
  measurements: Record<string, CardMeasurement>;
  viewportWidth: number;
}) {
  const items = args.items;
  const columnWidth = Math.max(
    CARD_WIDTH,
    ...items.map((item) => args.measurements[item.id]?.width ?? CARD_WIDTH),
  );
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
          mode: item.entityType === "page" ? item.canvasCardMode : undefined,
        } satisfies CanvasNodeState,
      ];
    }),
  );
}

export const ArchiveGroupCanvas = (props: Props) => {
  const canvasStore = createCanvasStore();
  const runCreateArchiveCanvasNode = useAction(createArchiveCanvasNode);
  const runDeleteArchiveCanvasNode = useAction(deleteArchiveCanvasNode);
  const runUpdateArchiveCanvasNode = useAction(updateArchiveCanvasNode);
  const runUpdateArchiveCanvasNodeState = useAction(updateArchiveCanvasNodeState);
  const runUpdateArchivedPageCanvasState = useAction(updateArchivedPageCanvasState);
  const runSaveArchiveGroupCanvasLayout = useAction(saveArchiveGroupCanvasLayout);

  const [nodes, setNodes] = createStore<Record<string, CanvasNodeState>>({});
  const [didInitialFit, setDidInitialFit] = createSignal(false);
  const [didSeedInitialPositions, setDidSeedInitialPositions] = createSignal(false);
  const [draggingId, setDraggingId] = createSignal<string>();
  const [resizingId, setResizingId] = createSignal<string>();
  const [activeId, setActiveId] = createSignal<string>();
  const [selectedId, setSelectedId] = createSignal<string>();
  const [editingNoteId, setEditingNoteId] = createSignal<string>();
  let canvasViewportRef: HTMLDivElement | undefined;
  let transformLayerRef: HTMLDivElement | undefined;
  const cardElements = new Map<string, HTMLDivElement>();

  const panZoomHandlers = createPanZoomHandlers(canvasStore);

  const itemsWithState = createMemo(() =>
    props.items.map((item) => {
      const node = nodes[item.id];
      if (item.entityType === "page") {
        return {
          ...item,
          canvasX: node?.x ?? item.canvasX,
          canvasY: node?.y ?? item.canvasY,
          canvasCardMode: node?.mode ?? item.canvasCardMode,
        };
      }

      return {
        ...item,
        canvasX: node?.x ?? item.canvasX,
        canvasY: node?.y ?? item.canvasY,
        canvasWidth: node?.width ?? item.canvasWidth,
        canvasHeight: node?.height ?? item.canvasHeight,
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
  const editingNote = createMemo(() => {
    const id = editingNoteId();
    if (!id) return null;
    const item = itemsById().get(id);
    return item?.entityType === "node" && item.kind === "note" ? item : null;
  });

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

  const getItemMeasurement = (item: ArchiveGroupCanvasItem): CardMeasurement => {
    if (item.entityType === "page") {
      return measureCard(cardElements.get(item.id), {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      });
    }

    return measureCard(cardElements.get(item.id), {
      width: item.canvasWidth ?? getDefaultNodeSize(item.kind).width,
      height: item.canvasHeight ?? getDefaultNodeSize(item.kind).height,
    });
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
      const measurement = getItemMeasurement(item);
      minX = Math.min(minX, item.canvasX);
      minY = Math.min(minY, item.canvasY);
      maxX = Math.max(maxX, item.canvasX + measurement.width);
      maxY = Math.max(maxY, item.canvasY + measurement.height);
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
    nextItems: Array<{
      entityType: "page" | "node";
      id: string;
      x: number;
      y: number;
      mode?: ArchivedPageCanvasCardMode;
      width?: number;
      height?: number;
    }>,
    options?: { successTitle?: string },
  ) => {
    try {
      await runSaveArchiveGroupCanvasLayout({
        items: nextItems.map((item) => ({
          entityType: item.entityType,
          id: item.id,
          canvasX: roundPosition(item.x),
          canvasY: roundPosition(item.y),
          canvasWidth: item.width ? roundPosition(item.width) : undefined,
          canvasHeight: item.height ? roundPosition(item.height) : undefined,
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
          mode: item.entityType === "page" ? item.canvasCardMode : undefined,
          width: item.entityType === "node" ? item.canvasWidth : undefined,
          height: item.entityType === "node" ? item.canvasHeight : undefined,
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
    const missing = props.items.filter(
      (item): item is ArchivedPageCanvasItem =>
        item.entityType === "page" && !item.hasPersistedPosition,
    );
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
          entityType: "page" as const,
          id: item.id,
          x: node.x,
          y: node.y,
          mode: node.mode ?? item.canvasCardMode,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (!seededItems.length) return;
    void persistLayout(seededItems);
  });

  createEffect(() => {
    const layer = transformLayerRef;
    if (!layer) return;
    const offset = canvasStore.offset();
    const scale = canvasStore.scale();
    const transform = `translate(${offset.x}px, ${offset.y}px) scale(${scale})`;
    layer.style.transform = transform;
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

    window.addEventListener("paste", handleCanvasPaste);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    canvasViewportRef?.addEventListener("mousedown", beginBackgroundMousePan);
    onCleanup(() => {
      window.removeEventListener("paste", handleCanvasPaste);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
      canvasViewportRef?.removeEventListener("mousedown", beginBackgroundMousePan);
    });
  });

  const persistNodeState = async (
    id: string,
    next: {
      x: number;
      y: number;
      mode?: ArchivedPageCanvasCardMode;
      width?: number;
      height?: number;
    },
  ) => {
    try {
      const item = itemsById().get(id);
      if (!item) return;

      if (item.entityType === "node") {
        await runUpdateArchiveCanvasNodeState({
          id,
          canvasX: roundPosition(next.x),
          canvasY: roundPosition(next.y),
          canvasWidth: next.width ? roundPosition(next.width) : undefined,
          canvasHeight: next.height ? roundPosition(next.height) : undefined,
        });
      } else {
        await runUpdateArchivedPageCanvasState({
          id,
          canvasX: roundPosition(next.x),
          canvasY: roundPosition(next.y),
          canvasCardMode: next.mode ?? item.canvasCardMode,
        });
      }
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

  const viewportCenterCanvasPoint = () => {
    const viewportRect = canvasViewportRef?.getBoundingClientRect();
    const viewOffset = canvasStore.offset();
    const viewScale = canvasStore.scale();
    const localX = (viewportRect?.width ?? window.innerWidth) / 2;
    const localY = (viewportRect?.height ?? window.innerHeight) / 2;
    return {
      x: (localX - viewOffset.x) / viewScale,
      y: (localY - viewOffset.y) / viewScale,
    };
  };

  const createNoteNode = async () => {
    try {
      const center = viewportCenterCanvasPoint();
      const created = await runCreateArchiveCanvasNode({
        groupName: props.groupName,
        kind: "note",
        canvasX: roundPosition(center.x),
        canvasY: roundPosition(center.y),
        canvasWidth: NOTE_NODE_WIDTH,
        canvasHeight: NOTE_NODE_HEIGHT,
        contentHtml: "<p>New note</p>",
      });
      await revalidate(fetchArchiveGroupCanvasItems.keyFor(props.groupName));
      setEditingNoteId(created.id);
      setActiveId(created.id);
    } catch (error) {
      toaster.create({
        type: "error",
        title: "Could not create note",
        description: error instanceof Error ? error.message : "Canvas note creation failed.",
      });
    }
  };

  const saveEditingNote = async (html: string) => {
    const current = editingNote();
    if (!current) return;
    await runUpdateArchiveCanvasNode({
      id: current.id,
      contentHtml: html,
    });
    await revalidate(fetchArchiveGroupCanvasItems.keyFor(props.groupName));
  };

  const saveInlineNote = (html: string) =>
    saveEditingNote(html).then(() => {
      setEditingNoteId(undefined);
    });

  const removeCanvasNode = async (id: string) => {
    try {
      await runDeleteArchiveCanvasNode({ id });
      if (editingNoteId() === id) setEditingNoteId(undefined);
      await revalidate(fetchArchiveGroupCanvasItems.keyFor(props.groupName));
    } catch (error) {
      toaster.create({
        type: "error",
        title: "Could not delete canvas item",
        description: error instanceof Error ? error.message : "Canvas item deletion failed.",
      });
    }
  };

  const handleCanvasPaste = async (event: ClipboardEvent) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }

    const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) =>
      item.type.startsWith("image/"),
    );
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;
    event.preventDefault();

    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      try {
        const center = viewportCenterCanvasPoint();
        await runCreateArchiveCanvasNode({
          groupName: props.groupName,
          kind: "image",
          canvasX: roundPosition(center.x),
          canvasY: roundPosition(center.y),
          canvasWidth: IMAGE_NODE_WIDTH,
          canvasHeight: IMAGE_NODE_HEIGHT,
          imageDataUrl: result,
        });
        await revalidate(fetchArchiveGroupCanvasItems.keyFor(props.groupName));
        toaster.create({
          type: "success",
          title: "Added image to canvas",
        });
      } catch (error) {
        toaster.create({
          type: "error",
          title: "Could not add pasted image",
          description: error instanceof Error ? error.message : "Canvas image creation failed.",
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleModeChange = async (id: string, mode: ArchivedPageCanvasCardMode) => {
    const currentItem = itemsById().get(id);
    const current = nodes[id];
    if (!current || current.mode === mode || currentItem?.entityType !== "page") return;
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
        width: latest.width,
        height: latest.height,
      };
      setNodes(itemId, {
        x: latest.x,
        y: latest.y,
        mode: latest.mode,
        width: latest.width,
        height: latest.height,
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

  const beginNodeResize = (event: PointerEvent, itemId: string, direction: ResizeDirection) => {
    event.stopPropagation();
    event.preventDefault();

    const item = itemsById().get(itemId);
    if (item?.entityType !== "node") return;

    const origin = nodes[itemId];
    if (!origin) return;

    const currentTarget = event.currentTarget;
    if (!(currentTarget instanceof HTMLElement)) return;

    const minSize = getMinNodeSize(item.kind);
    const startWidth = origin.width ?? item.canvasWidth ?? getDefaultNodeSize(item.kind).width;
    const startHeight = origin.height ?? item.canvasHeight ?? getDefaultNodeSize(item.kind).height;
    const startLeft = origin.x;
    const startTop = origin.y;
    const startRight = startLeft + startWidth;
    const startBottom = startTop + startHeight;
    const startX = event.clientX;
    const startY = event.clientY;
    const scale = canvasStore.scale();
    let latest = {
      ...origin,
      width: startWidth,
      height: startHeight,
    };

    try {
      currentTarget.setPointerCapture(event.pointerId);
    } catch (_) {}

    setActiveId(itemId);
    setResizingId(itemId);
    document.body.style.cursor = getResizeCursor(direction);

    const onPointerMove = (moveEvent: MouseEvent | PointerEvent) => {
      if ("preventDefault" in moveEvent) {
        moveEvent.preventDefault();
      }

      const deltaX = (moveEvent.clientX - startX) / scale;
      const deltaY = (moveEvent.clientY - startY) / scale;
      const next = {
        ...latest,
      };

      if (direction.includes("e")) {
        next.width = clampNodeSize(startWidth + deltaX, minSize.width, MAX_NODE_WIDTH);
      }

      if (direction.includes("s")) {
        next.height = clampNodeSize(startHeight + deltaY, minSize.height, MAX_NODE_HEIGHT);
      }

      if (direction.includes("w")) {
        next.width = clampNodeSize(startWidth - deltaX, minSize.width, MAX_NODE_WIDTH);
        next.x = roundPosition(startRight - next.width);
      }

      if (direction.includes("n")) {
        next.height = clampNodeSize(startHeight - deltaY, minSize.height, MAX_NODE_HEIGHT);
        next.y = roundPosition(startBottom - next.height);
      }

      latest = next;

      setNodes(itemId, {
        x: latest.x,
        y: latest.y,
        mode: latest.mode,
        width: latest.width,
        height: latest.height,
      });
    };

    const finish = async () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("mouseup", finish);
      window.removeEventListener("pointercancel", finish);
      try {
        currentTarget.releasePointerCapture(event.pointerId);
      } catch (_) {}
      document.body.style.cursor = "";
      setResizingId((value) => (value === itemId ? undefined : value));
      await persistNodeState(itemId, latest);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("mouseup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const arrangeGrid = async () => {
    const measurements = Object.fromEntries(
      itemsWithState().map((item) => {
        return [
          item.id,
          getItemMeasurement(item),
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
      Object.entries(nextLayout)
        .map(([id, layout]) => {
          const item = itemsById().get(id);
          if (!item) return null;
          return {
            entityType: item.entityType,
            id,
            x: layout.x,
            y: layout.y,
            mode: layout.mode,
            width: item.entityType === "node" ? nodes[id]?.width ?? item.canvasWidth : undefined,
            height:
              item.entityType === "node" ? nodes[id]?.height ?? item.canvasHeight : undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      { successTitle: "Saved grid arrangement" },
    );
    fitToContent();
  };

  const beginBackgroundMousePan = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (
      target !== canvasViewportRef &&
      target !== transformLayerRef &&
      !(target instanceof HTMLElement && target.closest('[data-archive-canvas-card="true"]'))
    ) {
      return;
    }

    event.preventDefault();
    let lastX = event.clientX;
    let lastY = event.clientY;
    let moved = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - lastX;
      const dy = moveEvent.clientY - lastY;
      if (!moved && Math.hypot(moveEvent.clientX - event.clientX, moveEvent.clientY - event.clientY) >= 6) {
        moved = true;
        canvasStore.setIsPanning(true);
      }
      if (moved) {
        const offset = canvasStore.offset();
        canvasStore.setOffset({ x: offset.x + dx, y: offset.y + dy });
        canvasStore.scheduleTransform();
      }
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;
    };

    const finish = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", finish);
      canvasStore.setIsPanning(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", finish);
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
                Drag, resize, and edit notes inline. Paste an image anywhere on the canvas.
              </Text>
            </HStack>
          </HStack>

          <HStack gap="2" flexWrap="wrap">
            <Button type="button" variant="solid" onClick={() => void createNoteNode()}>
              Add note
            </Button>
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
          pointerEvents="none"
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
                        pointerEvents="auto"
                        data-archive-canvas-card="true"
                        style={{
                          transform: `translate(${current().canvasX}px, ${current().canvasY}px)`,
                        }}
                      >
                        <Show
                          when={current().entityType === "page"}
                          fallback={
                            <ArchiveCanvasFreeformCard
                              item={current() as ArchivedCanvasNodeItem}
                              isActive={itemId === activeId()}
                              isDragging={draggingId() === itemId}
                              isEditing={editingNoteId() === itemId}
                              isResizing={resizingId() === itemId}
                              cardRef={(element) => {
                                if (element) {
                                  cardElements.set(itemId, element);
                                  return;
                                }
                                cardElements.delete(itemId);
                              }}
                              onActivate={() => setActiveId(itemId)}
                              onDragStart={(event) => beginCardDrag(event, itemId)}
                              onResizeStart={(event, direction) =>
                                beginNodeResize(event, itemId, direction)
                              }
                              onStartEditing={() => setEditingNoteId(itemId)}
                              onCancelEditing={() => setEditingNoteId(undefined)}
                              onSaveNote={saveInlineNote}
                              onDelete={() => void removeCanvasNode(itemId)}
                            />
                          }
                        >
                          <ArchiveCanvasCard
                            item={current() as ArchivedPageCanvasItem}
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
                        </Show>
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
