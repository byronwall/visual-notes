import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { Box } from "styled-system/jsx";
import { DocPreviewSummary } from "~/components/docs/DocPreviewSummary";
import {
  candidateHexCells,
  hexCellCenter,
  hexCellKey,
  nearestHexCell,
  type HexGridCell,
} from "~/layout/hex-card-grid";
import type { DocItem } from "~/types/notes";
import { colorFor } from "~/utils/colors";

type Point = { x: number; y: number };

type VisibleHexCard = {
  doc: DocItem;
  anchor: Point;
  center: Point;
};

export type CanvasHexCardLayerProps = {
  docs: DocItem[];
  positions: Accessor<Map<string, Point>>;
  scale: Accessor<number>;
  offset: Accessor<Point>;
  hoveredId: Accessor<string | undefined>;
  showHoverLabel: Accessor<boolean>;
  onSelectDoc: (id: string) => void;
  isSelected: (id: string) => boolean;
  hideNonMatches: Accessor<boolean>;
  searchQuery: Accessor<string>;
};

const PANEL_WIDTH = 336;
const CARD_LIMIT = 20;
const CARD_WIDTH = 146;
const CARD_HEIGHT = 124;
const HEX_WIDTH = 176;
const HEX_HEIGHT = 162;
const GRID_COLUMN_WIDTH = 188;
const GRID_ROW_HEIGHT = 170;
const MAX_CELL_RADIUS = 4;

export const CanvasHexCardLayer: VoidComponent<CanvasHexCardLayerProps> = (
  props
) => {
  let containerRef: HTMLDivElement | undefined;
  const [viewport, setViewport] = createSignal({ width: 0, height: 0 });

  onMount(() => {
    if (!containerRef || typeof ResizeObserver === "undefined") return;
    const updateViewport = () => {
      if (!containerRef) return;
      setViewport({
        width: Math.round(containerRef.clientWidth),
        height: Math.round(containerRef.clientHeight),
      });
    };
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(containerRef);
    onCleanup(() => observer.disconnect());
  });

  createEffect(() => {
    if (!containerRef) return;
    setViewport({
      width: Math.round(containerRef.clientWidth),
      height: Math.round(containerRef.clientHeight),
    });
  });

  const searchMatches = (doc: DocItem) => {
    const q = props.searchQuery().trim().toLowerCase();
    if (!q) return true;
    return doc.title.toLowerCase().includes(q);
  };

  const visibleCards = createMemo<VisibleHexCard[]>(() => {
    const docs = props.docs;
    const positions = props.positions();
    const scale = props.scale();
    const offset = props.offset();
    const viewportSize = viewport();
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return [];

    const availableLeft = PANEL_WIDTH + HEX_WIDTH / 2;
    const availableRight = viewportSize.width - HEX_WIDTH / 2;
    const availableTop = HEX_HEIGHT / 2;
    const availableBottom = viewportSize.height - HEX_HEIGHT / 2;
    if (availableRight <= availableLeft || availableBottom <= availableTop) {
      return [];
    }

    const center = {
      x: (availableLeft + availableRight) / 2,
      y: (availableTop + availableBottom) / 2,
    };
    const paddedBounds = {
      left: availableLeft - GRID_COLUMN_WIDTH,
      right: availableRight + GRID_COLUMN_WIDTH,
      top: availableTop - GRID_ROW_HEIGHT,
      bottom: availableBottom + GRID_ROW_HEIGHT,
    };

    const candidates = docs
      .filter((doc) => !props.hideNonMatches() || searchMatches(doc))
      .map((doc) => {
        const pos = positions.get(doc.id);
        if (!pos) return undefined;
        const anchor = {
          x: pos.x * scale + offset.x,
          y: pos.y * scale + offset.y,
        };
        const inPaddedViewport =
          anchor.x >= paddedBounds.left &&
          anchor.x <= paddedBounds.right &&
          anchor.y >= paddedBounds.top &&
          anchor.y <= paddedBounds.bottom;
        if (!inPaddedViewport) return undefined;
        const dx = anchor.x - center.x;
        const dy = anchor.y - center.y;
        const dist2 = dx * dx + dy * dy;
        const isHovered =
          props.showHoverLabel() && props.hoveredId() === doc.id ? 1 : 0;
        const isSelected = props.isSelected(doc.id) ? 1 : 0;
        return {
          doc,
          anchor,
          dist2,
          priority:
            dist2 - isSelected * 1_000_000 - isHovered * 2_000_000,
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, CARD_LIMIT * 3);

    const used = new Set<string>();
    const placed: VisibleHexCard[] = [];

    const clampCellToViewport = (cell: HexGridCell) => {
      const center = hexCellCenter(cell, {
        columnWidth: GRID_COLUMN_WIDTH,
        rowHeight: GRID_ROW_HEIGHT,
        originX: availableLeft,
        originY: availableTop,
      });
      return (
        center.x >= availableLeft &&
        center.x <= availableRight &&
        center.y >= availableTop &&
        center.y <= availableBottom
      );
    };

    for (const candidate of candidates) {
      if (placed.length >= CARD_LIMIT) break;
      const preferred = nearestHexCell(candidate.anchor, {
        columnWidth: GRID_COLUMN_WIDTH,
        rowHeight: GRID_ROW_HEIGHT,
        originX: availableLeft,
        originY: availableTop,
      });
      const options = candidateHexCells(preferred, MAX_CELL_RADIUS)
        .filter(clampCellToViewport)
        .sort((a, b) => {
          const ca = hexCellCenter(a, {
            columnWidth: GRID_COLUMN_WIDTH,
            rowHeight: GRID_ROW_HEIGHT,
            originX: availableLeft,
            originY: availableTop,
          });
          const cb = hexCellCenter(b, {
            columnWidth: GRID_COLUMN_WIDTH,
            rowHeight: GRID_ROW_HEIGHT,
            originX: availableLeft,
            originY: availableTop,
          });
          const da =
            (ca.x - candidate.anchor.x) * (ca.x - candidate.anchor.x) +
            (ca.y - candidate.anchor.y) * (ca.y - candidate.anchor.y);
          const db =
            (cb.x - candidate.anchor.x) * (cb.x - candidate.anchor.x) +
            (cb.y - candidate.anchor.y) * (cb.y - candidate.anchor.y);
          return da - db;
        });

      const selectedCell = options.find((cell) => !used.has(hexCellKey(cell)));
      if (!selectedCell) continue;
      used.add(hexCellKey(selectedCell));
      placed.push({
        doc: candidate.doc,
        anchor: candidate.anchor,
        center: hexCellCenter(selectedCell, {
          columnWidth: GRID_COLUMN_WIDTH,
          rowHeight: GRID_ROW_HEIGHT,
          originX: availableLeft,
          originY: availableTop,
        }),
      });
    }

    return placed;
  });

  return (
    <Box ref={containerRef} position="absolute" inset="0" pointerEvents="none">
      <Show when={visibleCards().length > 0}>
        <svg
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: "0", overflow: "visible" }}
        >
          <For each={visibleCards()}>
            {(item) => {
              const selected = () => props.isSelected(item.doc.id);
              const hovered = () =>
                props.showHoverLabel() && props.hoveredId() === item.doc.id;
              return (
                <line
                  x1={item.anchor.x}
                  y1={item.anchor.y}
                  x2={item.center.x}
                  y2={item.center.y}
                  stroke={selected() ? "rgba(29, 78, 216, 0.55)" : "rgba(15, 23, 42, 0.18)"}
                  stroke-width={selected() ? "2.5" : hovered() ? "2" : "1.25"}
                />
              );
            }}
          </For>
        </svg>

        <For each={visibleCards()}>
          {(item) => {
            const selected = () => props.isSelected(item.doc.id);
            const hovered = () =>
              props.showHoverLabel() && props.hoveredId() === item.doc.id;
            const accent = () => colorFor(item.doc.path || item.doc.title);

            return (
              <Box
                position="absolute"
                pointerEvents="auto"
                style={{
                  left: `${item.center.x - HEX_WIDTH / 2}px`,
                  top: `${item.center.y - HEX_HEIGHT / 2}px`,
                  width: `${HEX_WIDTH}px`,
                  height: `${HEX_HEIGHT}px`,
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onSelectDoc(item.doc.id);
                }}
              >
                <Box
                  position="absolute"
                  inset="0"
                  borderWidth={selected() ? "2px" : "1px"}
                  borderColor={selected() ? "blue.600" : hovered() ? "border.emphasized" : "border"}
                  bg="bg.subtle"
                  boxShadow={selected() ? "lg" : "md"}
                  style={{
                    "clip-path":
                      "polygon(25% 5%, 75% 5%, 95% 50%, 75% 95%, 25% 95%, 5% 50%)",
                  }}
                />
                <Box
                  position="absolute"
                  left="50%"
                  top="50%"
                  borderRadius="l2"
                  bg="bg.default"
                  borderWidth="1px"
                  borderColor={selected() ? "blue.600" : "border"}
                  boxShadow="sm"
                  overflow="hidden"
                  style={{
                    width: `${CARD_WIDTH}px`,
                    height: `${CARD_HEIGHT}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <Box h="4px" bg={accent()} />
                  <Box p="3">
                    <DocPreviewSummary
                      title={item.doc.title}
                      updatedAt={item.doc.updatedAt}
                      path={item.doc.path}
                      meta={item.doc.meta}
                    />
                  </Box>
                </Box>
              </Box>
            );
          }}
        </For>
      </Show>
    </Box>
  );
};
