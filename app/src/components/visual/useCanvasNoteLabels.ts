import { createMemo, type Accessor } from "solid-js";
import type { UmapRegionsSnapshot } from "~/features/umap/region-types";
import { seededPositionFor } from "~/layout/seeded";
import type { DocItem } from "~/types/notes";
import { measureCanvasWork } from "./canvas-perf";
import {
  SPREAD,
  toBounds,
  type Bounds,
  type Point,
} from "./labels/label-geometry";
import {
  buildAnchoredHoveredNoteLabelLayout,
  buildNoteLabelLayouts,
  type NoteLabelLayout,
} from "./labels/note-label-layout";
import {
  buildStableNoteLabelOrder,
  getVisibleNoteLabelCount,
} from "./labels/note-label-order";
import type { RegionLabelLayout } from "./labels/region-label-geometry";
import { useFrozenHoveredNoteLabel } from "./useFrozenHoveredNoteLabel";

/**
 * Note label state for the canvas: a few spread-out note titles placed
 * around the region labels, plus the hovered note's anchored label.
 */
export function useCanvasNoteLabels(args: {
  visibleDocs: Accessor<DocItem[]>;
  positions: Accessor<Map<string, Point>>;
  matchingDocIds: Accessor<Set<string> | null | undefined>;
  notesInteractive: Accessor<boolean>;
  dotHoveredId: Accessor<string | undefined>;
  zoomScale: Accessor<number>;
  labelFontSize: Accessor<number>;
  viewportBounds: Accessor<Bounds | undefined>;
  regions: Accessor<UmapRegionsSnapshot | null>;
  selectedRegionId: Accessor<string | undefined>;
  regionLabelLayouts: Accessor<RegionLabelLayout[]>;
  fixedSelectedRegionLayout: Accessor<RegionLabelLayout | null>;
}) {
  const labelCandidateDocs = createMemo(() => {
    const matching = args.matchingDocIds();
    const docs = args.visibleDocs();
    return matching ? docs.filter((doc) => matching.has(doc.id)) : docs;
  });
  const visibleCount = createMemo(() =>
    args.notesInteractive()
      ? getVisibleNoteLabelCount({
          visibleCount: labelCandidateDocs().length,
          zoomScale: args.zoomScale(),
        })
      : 0,
  );
  const visibleDocMap = createMemo(
    () => new Map(args.visibleDocs().map((doc) => [doc.id, doc])),
  );
  const anchoredHoveredLayout = createMemo(() => {
    const hoveredDocId = args.dotHoveredId();
    if (!args.notesInteractive() || !hoveredDocId) return null;
    const doc = visibleDocMap().get(hoveredDocId);
    if (!doc) return null;
    const docsForLabels = args.visibleDocs();
    const docIndex = docsForLabels.findIndex(
      (item) => item.id === hoveredDocId,
    );
    if (docIndex < 0) return null;
    const position =
      args.positions().get(hoveredDocId) ??
      seededPositionFor(doc.title, docIndex, SPREAD);
    return buildAnchoredHoveredNoteLabelLayout({
      doc,
      position,
      zoomScale: args.zoomScale(),
      labelFontSize: args.labelFontSize(),
      viewportBounds: args.viewportBounds(),
    });
  });
  const frozen = useFrozenHoveredNoteLabel(() => anchoredHoveredLayout());
  // Ordering ignores hover so moving between notes never re-ranks the map.
  const candidateOrder = createMemo(() => {
    if (!args.notesInteractive()) return [] as string[];
    const count = visibleCount();
    if (count <= 0) return [] as string[];
    const docs = labelCandidateDocs();
    const positions = args.positions();
    const viewportBounds = args.viewportBounds();
    return measureCanvasWork("noteLabelOrder", () =>
      buildStableNoteLabelOrder({
        docs,
        positions,
        viewportBounds,
        // Extra candidates cover labels that fail placement.
        limit: count * 3 + 1,
      }),
    );
  });
  const visibleOrder = createMemo(() => {
    const anchoredDocId = frozen.activeLayout()?.docId;
    return candidateOrder()
      .filter((docId) => docId !== anchoredDocId)
      .slice(0, visibleCount());
  });
  const layouts = createMemo(() => {
    const selectedRegionId = args.selectedRegionId();
    if (!args.notesInteractive()) return [] as NoteLabelLayout[];
    const fixedRegionLayout = args.fixedSelectedRegionLayout();
    const regionBoxes = fixedRegionLayout
      ? [...args.regionLabelLayouts(), fixedRegionLayout]
      : args.regionLabelLayouts();
    const occupiedBoxes = regionBoxes.map(toBounds);
    const anchoredLayout = frozen.activeLayout();
    if (anchoredLayout) {
      occupiedBoxes.push(toBounds(anchoredLayout));
    }
    const selectedRegion = (args.regions()?.regions ?? []).find(
      (region) => region.id === selectedRegionId,
    );
    const placed = buildNoteLabelLayouts({
      docs: labelCandidateDocs(),
      positions: args.positions(),
      labeledIds: new Set(visibleOrder()),
      labelOrder: visibleOrder(),
      zoomScale: args.zoomScale(),
      labelFontSize: args.labelFontSize(),
      selectedRegion: selectedRegion
        ? {
            centroid: selectedRegion.centroid,
            radius: Math.max(18, selectedRegion.radius),
          }
        : undefined,
      viewportBounds: args.viewportBounds(),
      occupiedBoxes,
    });
    return anchoredLayout ? [anchoredLayout, ...placed] : placed;
  });

  return {
    layouts,
    visibleDocMap,
    setPointerOverNoteLabelId: frozen.setPointerOverNoteLabelId,
    resetHoveredLabel: frozen.reset,
  };
}
