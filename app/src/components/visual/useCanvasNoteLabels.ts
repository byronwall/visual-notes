import { createEffect, createMemo, on, untrack, type Accessor } from "solid-js";
import type { UmapRegionItem } from "~/features/umap/region-types";
import type { DocItem } from "~/types/notes";
import { measureCanvasWork } from "./canvas-perf";
import { toBounds, type Bounds, type Point } from "./labels/label-geometry";
import {
  buildAnchoredHoveredNoteLabelLayout,
  buildNoteLabelLayouts,
  type NoteLabelLayout,
} from "./labels/note-label-layout";
import {
  getVisibleNoteLabelCount,
  rankNoteLabelCandidates,
} from "./labels/note-label-order";
import type { CanvasView } from "./labels/settled-view";
import { useCrossFade } from "./useCrossFade";
import { useFrozenHoveredNoteLabel } from "./useFrozenHoveredNoteLabel";

export const NOTE_LABEL_FONT_PX = 12.5;

/** A placed note label plus the zoom it was laid out at. */
export type PlacedNoteLabel = {
  layout: NoteLabelLayout;
  layoutZoom: number;
  hovered?: boolean;
};

/**
 * Note label state for the canvas. Ranked labels are planned for the
 * settled view only (see `rankNoteLabelCandidates` for the rule), so which
 * notes are labeled never changes mid-gesture; changes cross-fade. The
 * hovered note's anchored label follows the live zoom.
 */
export function useCanvasNoteLabels(args: {
  docs: Accessor<DocItem[]>;
  positions: Accessor<Map<string, Point>>;
  matchingDocIds: Accessor<Set<string> | null | undefined>;
  notesInteractive: Accessor<boolean>;
  dotHoveredId: Accessor<string | undefined>;
  zoomScale: Accessor<number>;
  settledView: Accessor<CanvasView>;
  /** Bumps when ranked labels should re-plan (see `useSettledView`). */
  planEpoch: Accessor<number>;
  /** Ask for a re-plan once the view is still. */
  requestReplan: () => void;
  /** Label area (world units) for the settled view. */
  settledBounds: Accessor<Bounds | undefined>;
  /** Label area for the live view; only the hovered label uses it. */
  liveBounds: Accessor<Bounds | undefined>;
  regions: Accessor<UmapRegionItem[]>;
  selectedRegionId: Accessor<string | undefined>;
  regionLabelBoxes: Accessor<Bounds[]>;
}) {
  const docMap = createMemo(
    () => new Map(args.docs().map((doc) => [doc.id, doc])),
  );
  const candidateDocs = createMemo(() => {
    const matching = args.matchingDocIds();
    const docs = args.docs();
    return matching ? docs.filter((doc) => matching.has(doc.id)) : docs;
  });
  const anchoredHoveredLayout = createMemo(() => {
    const hoveredDocId = args.dotHoveredId();
    if (!args.notesInteractive() || !hoveredDocId) return null;
    const doc = docMap().get(hoveredDocId);
    const position = args.positions().get(hoveredDocId);
    if (!doc || !position) return null;
    return buildAnchoredHoveredNoteLabelLayout({
      doc,
      position,
      zoomScale: args.zoomScale(),
      labelFontSize: NOTE_LABEL_FONT_PX / args.zoomScale(),
      viewportBounds: args.liveBounds(),
    });
  });
  const frozen = useFrozenHoveredNoteLabel(() => anchoredHoveredLayout());

  // Data, search, selection, and interactivity changes only request a
  // re-plan; the plan itself runs on the epoch, i.e. once the view is
  // still. Selecting a region therefore never labels the old view while the
  // camera flies to the new one.
  createEffect(
    on(
      [
        candidateDocs,
        args.positions,
        args.selectedRegionId,
        args.notesInteractive,
        args.regions,
      ],
      () => args.requestReplan(),
      { defer: true },
    ),
  );

  const planNow = (): PlacedNoteLabel[] => {
    const view = args.settledView();
    const bounds = args.settledBounds();
    const docs = candidateDocs();
    const positions = args.positions();
    const selectedRegionId = args.selectedRegionId();
    const occupied = args.regionLabelBoxes();
    if (!args.notesInteractive()) return [];
    return measureCanvasWork("noteLabelPlan", () => {
      const ranked = rankNoteLabelCandidates({ docs, positions, bounds });
      const count = getVisibleNoteLabelCount({
        visibleCount: ranked.length,
        zoomScale: view.zoom,
      });
      if (count <= 0) return [];
      const selectedRegion = args
        .regions()
        .find((region) => region.id === selectedRegionId);
      const layouts = buildNoteLabelLayouts({
        docs,
        positions,
        labeledIds: new Set(ranked),
        labelOrder: ranked,
        zoomScale: view.zoom,
        labelFontSize: NOTE_LABEL_FONT_PX / view.zoom,
        selectedRegion: selectedRegion
          ? {
              centroid: selectedRegion.centroid,
              radius: Math.max(18, selectedRegion.radius),
            }
          : undefined,
        viewportBounds: bounds,
        occupiedBoxes: occupied,
        maxCount: count,
        skipOverlapping: true,
      });
      return layouts.map((layout) => ({ layout, layoutZoom: view.zoom }));
    });
  };
  const plan = createMemo((): PlacedNoteLabel[] => {
    args.planEpoch();
    return untrack(() => planNow());
  });

  const placed = createMemo((): PlacedNoteLabel[] => {
    const anchored = frozen.activeLayout();
    if (!anchored) return plan();
    const anchoredBox = toBounds(anchored);
    const zoom = untrack(args.zoomScale);
    return [
      { layout: anchored, layoutZoom: zoom, hovered: true },
      // Ranked labels under the hover bubble step aside until it clears.
      ...plan().filter(
        (item) =>
          item.layout.docId !== anchored.docId &&
          !boxesTouch(toBounds(item.layout), anchoredBox),
      ),
    ];
  });

  // A label that moves to a new spot fades out and back in rather than
  // sliding; one that keeps its spot keeps its element.
  const labels = useCrossFade(
    () => placed(),
    (item) => {
      if (item.hovered) return `hover:${item.layout.docId}`;
      const { layout, layoutZoom } = item;
      const dx = Math.round((layout.minX - layout.leaderStartX) * layoutZoom);
      const dy = Math.round((layout.minY - layout.leaderStartY) * layoutZoom);
      return `${layout.docId}@${dx},${dy}`;
    },
  );

  return {
    labels,
    docMap,
    setPointerOverNoteLabelId: frozen.setPointerOverNoteLabelId,
    resetHoveredLabel: frozen.reset,
  };
}

function boxesTouch(a: Bounds, b: Bounds) {
  return (
    a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY
  );
}
