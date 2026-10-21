import { createMemo, type Accessor } from "solid-js";
import type { UmapRegionItem } from "~/features/umap/region-types";
import { measureCanvasWork } from "./canvas-perf";
import type { Bounds } from "./labels/label-geometry";
import {
  planRegionLabels,
  regionLabelTier,
  regionLabelWorldBox,
} from "./labels/region-label-plan";
import { buildStableRegionLabelOrder } from "./labels/region-label-order";
import type { RegionShape } from "./regions/region-shape";

/**
 * Region label state for the canvas. The plan follows the settled zoom's
 * tier, so it is rebuilt only when a gesture ends in a new tier, never per
 * frame.
 */
export function useCanvasRegionLabels(args: {
  regions: Accessor<UmapRegionItem[]>;
  shapes: Accessor<Map<string, RegionShape>>;
  settledZoom: Accessor<number>;
  regionsOnly: Accessor<boolean>;
  selectedRegionId: Accessor<string | undefined>;
  hoveredRegionId: Accessor<string | undefined>;
}) {
  const stableOrder = createMemo(() => {
    const regions = args.regions();
    return measureCanvasWork("stableRegionLabelOrder", () =>
      buildStableRegionLabelOrder(regions),
    );
  });
  const tier = createMemo(() => regionLabelTier(args.settledZoom()));
  const plan = createMemo(() => {
    const currentTier = tier();
    const regions = args.regions();
    const shapes = args.shapes();
    const order = stableOrder();
    const regionsOnly = args.regionsOnly();
    const selectedRegionId = args.selectedRegionId();
    return measureCanvasWork("regionLabelPlan", () =>
      planRegionLabels({
        regions,
        shapes,
        order,
        // Any zoom in the tier gives the same plan; use its exact floor.
        zoom: 2 ** (currentTier / 2),
        regionsOnly,
        selectedRegionId,
      }),
    );
  });
  const labeledRegionIds = createMemo(() => new Set(plan().labeledIds));
  /** World boxes of shown region labels at the settled zoom, for note labels to avoid. */
  const occupiedBoxes = createMemo(() => {
    const zoom = args.settledZoom();
    const { layouts } = plan();
    const boxes: Bounds[] = [];
    for (const regionId of labeledRegionIds()) {
      const layout = layouts.get(regionId);
      if (layout) boxes.push(regionLabelWorldBox(layout, zoom, 4));
    }
    return boxes;
  });
  /**
   * Shape stacking: larger shapes underneath, so a small region overlapping
   * a big one stays reachable, and the selected region on top. Hover never
   * restacks shapes; if it did, the region under a point would depend on
   * the path the pointer took to get there.
   */
  const shapeOrder = createMemo(() => {
    const selectedId = args.selectedRegionId();
    const shapes = args.shapes();
    const area = (id: string) => {
      const bounds = shapes.get(id)?.bounds;
      return bounds
        ? (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
        : 0;
    };
    return args
      .regions()
      .slice()
      .sort((a, b) => {
        if (a.id === selectedId) return 1;
        if (b.id === selectedId) return -1;
        return area(b.id) - area(a.id) || a.id.localeCompare(b.id);
      });
  });
  /** Labels: selected draws last, then hovered, so they sit on top. */
  const labelOrder = createMemo(() => {
    const hoveredId = args.hoveredRegionId();
    const selectedId = args.selectedRegionId();
    return args
      .regions()
      .slice()
      .sort((a, b) => {
        if (a.id === selectedId) return 1;
        if (b.id === selectedId) return -1;
        if (a.id === hoveredId) return 1;
        if (b.id === hoveredId) return -1;
        return 0;
      });
  });

  return {
    layouts: () => plan().layouts,
    labeledRegionIds,
    occupiedBoxes,
    shapeOrder,
    labelOrder,
  };
}
