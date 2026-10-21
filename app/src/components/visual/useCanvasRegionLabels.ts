import { createMemo, type Accessor } from "solid-js";
import type { UmapRegionsSnapshot } from "~/features/umap/region-types";
import { measureCanvasWork } from "./canvas-perf";
import { toBounds, type Bounds, type Point } from "./labels/label-geometry";
import {
  SELECTED_REGION_INSIDE_LABEL_ZOOM,
  type RegionLabelLayout,
} from "./labels/region-label-geometry";
import { buildRegionLabelLayouts } from "./labels/region-label-layout";
import {
  buildStableRegionLabelOrder,
  getVisibleRegionLabelCount,
} from "./labels/region-label-order";
import { buildFixedSelectedRegionLabelLayout } from "./labels/selected-region-label";

/**
 * Region label state for the canvas: which regions are labeled at this zoom
 * and where each label sits, plus the hovered region's extra label and the
 * selected region's pinned label.
 */
export function useCanvasRegionLabels(args: {
  regions: Accessor<UmapRegionsSnapshot | null>;
  zoomScale: Accessor<number>;
  offset: Accessor<Point>;
  labelFontSize: Accessor<number>;
  viewportBounds: Accessor<Bounds | undefined>;
  regionsOnly: Accessor<boolean>;
  selectedRegionId: Accessor<string | undefined>;
  hoveredRegionId: Accessor<string | undefined>;
}) {
  const regionList = () => args.regions()?.regions ?? [];

  const stableOrder = createMemo(() => {
    const regions = regionList();
    return measureCanvasWork("stableRegionLabelOrder", () =>
      buildStableRegionLabelOrder(regions),
    );
  });
  const visibleCount = createMemo(() =>
    getVisibleRegionLabelCount({
      regionCount: args.regions()?.regions.length ?? 0,
      zoomScale: args.zoomScale(),
      regionsOnly: args.regionsOnly(),
    }),
  );
  const labeledRegionOrder = createMemo(() => {
    const selectedId = args.selectedRegionId();
    if (selectedId) return [selectedId];
    return stableOrder().slice(0, visibleCount());
  });
  const labeledRegionIds = createMemo(() => {
    const selectedId = args.selectedRegionId();
    if (selectedId) return new Set([selectedId]);
    const regions = regionList();
    if (regions.length <= visibleCount()) {
      return new Set(regions.map((region) => region.id));
    }
    return new Set(labeledRegionOrder());
  });
  const layouts = createMemo(() => {
    const regions = regionList();
    const selectedId = args.selectedRegionId();
    const emphasizedIds = selectedId ? new Set([selectedId]) : undefined;
    const labelIds = labeledRegionIds();
    const labelOrder = labeledRegionOrder();
    const currentZoomScale = args.zoomScale();
    const labelFontSize = args.labelFontSize();
    const currentViewportBounds = args.viewportBounds();
    return measureCanvasWork("baseRegionLabelLayouts", () =>
      buildRegionLabelLayouts({
        regions,
        labeledIds: labelIds,
        labelOrder,
        emphasizedIds,
        zoomScale: currentZoomScale,
        offset: args.offset(),
        labelFontSize,
        allowRegionOverlap: false,
        viewportBounds: currentViewportBounds,
      }),
    );
  });
  const hoveredLayout = createMemo(() => {
    const hoveredId = args.hoveredRegionId();
    if (!hoveredId || labeledRegionIds().has(hoveredId)) return null;
    const regions = regionList();
    const occupiedBoxes = layouts().map(toBounds);
    const currentZoomScale = args.zoomScale();
    const labelFontSize = args.labelFontSize();
    const currentViewportBounds = args.viewportBounds();
    const layout = measureCanvasWork(
      "hoveredRegionLabelLayout",
      () =>
        buildRegionLabelLayouts({
          regions,
          labeledIds: new Set([hoveredId]),
          labelOrder: [hoveredId],
          emphasizedIds: new Set([hoveredId]),
          zoomScale: currentZoomScale,
          offset: args.offset(),
          labelFontSize,
          allowRegionOverlap: false,
          viewportBounds: currentViewportBounds,
          occupiedBoxes,
        })[0],
    );
    return layout ?? null;
  });
  const layoutById = createMemo(
    () =>
      new Map<string, RegionLabelLayout>(
        [...layouts(), ...(hoveredLayout() ? [hoveredLayout()!] : [])].map(
          (layout) => [layout.regionId, layout],
        ),
      ),
  );
  const fixedSelectedLayout = createMemo(() => {
    const selectedId = args.selectedRegionId();
    if (!selectedId || args.zoomScale() >= SELECTED_REGION_INSIDE_LABEL_ZOOM) {
      return null;
    }
    const region = regionList().find((item) => item.id === selectedId);
    if (!region) return null;
    return buildFixedSelectedRegionLabelLayout({
      region,
      zoomScale: args.zoomScale(),
      offset: args.offset(),
      labelFontSize: args.labelFontSize(),
      viewportBounds: args.viewportBounds(),
    });
  });
  /** Selected region draws last, then hovered, so they sit on top. */
  const renderOrder = createMemo(() => {
    const hoveredId = args.hoveredRegionId();
    const selectedId = args.selectedRegionId();
    return regionList()
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
    labeledRegionIds,
    layouts,
    layoutById,
    fixedSelectedLayout,
    renderOrder,
  };
}
