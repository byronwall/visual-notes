import type { UmapRegionItem } from "~/features/umap/region-types";
import type { RegionShape } from "../regions/region-shape";
import { wrapRegionTitle, type Bounds } from "./label-geometry";
import { getVisibleRegionLabelCount } from "./region-label-order";

export const REGION_LABEL_FONT_PX = 16;
export const REGION_LABEL_LINE_PX = 15.2;
/** Average bold glyph width as a share of the font size. */
const GLYPH_WIDTH = 0.56;
const LABEL_SPACING_PX = 8;
/** Gap between an "above" label and the top of its shape. */
const ABOVE_GAP_PX = 6;
/** A shape taller than this on screen takes its label above, not inside. */
const ABOVE_MIN_SHAPE_PX = 200;
/** Zoom tiers are half an octave: each tier spans a √2 zoom range. */
const TIERS_PER_OCTAVE = 2;

/**
 * Where a region label sits. The anchor is a fixed world point; the box is
 * in screen pixels relative to it. Drawing translates to the anchor and
 * scales by 1 / live zoom, so the text keeps its size and stays glued to
 * its region through any zoom: nothing re-places it mid-gesture.
 */
export type RegionLabelLayout = {
  regionId: string;
  lines: string[];
  placement: "center" | "above";
  anchorX: number;
  anchorY: number;
  /** Text block in px relative to the anchor; x is centered on 0. */
  box: { left: number; top: number; width: number; height: number };
};

export function regionLabelTier(zoom: number) {
  return Math.floor(Math.log2(Math.max(1e-6, zoom)) * TIERS_PER_OCTAVE);
}

/** Smallest zoom in a tier. Labels collide-check there, where they are largest in world units. */
export function tierMinZoom(tier: number) {
  return 2 ** (tier / TIERS_PER_OCTAVE);
}

export function measureRegionLabelPx(lines: string[]) {
  const longest = Math.max(...lines.map((line) => line.length), 4);
  return {
    width: Math.ceil(longest * REGION_LABEL_FONT_PX * GLYPH_WIDTH) + 8,
    height: Math.ceil(lines.length * REGION_LABEL_LINE_PX) + 6,
  };
}

/** The label's box in world units when drawn at `zoom`. */
export function regionLabelWorldBox(
  layout: RegionLabelLayout,
  zoom: number,
  paddingPx = 0,
): Bounds {
  return {
    minX: layout.anchorX + (layout.box.left - paddingPx) / zoom,
    minY: layout.anchorY + (layout.box.top - paddingPx) / zoom,
    maxX:
      layout.anchorX + (layout.box.left + layout.box.width + paddingPx) / zoom,
    maxY:
      layout.anchorY + (layout.box.top + layout.box.height + paddingPx) / zoom,
  };
}

function overlaps(a: Bounds, b: Bounds) {
  return (
    a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY
  );
}

/**
 * One region's label for a tier. Small shapes hold their name centered on
 * the hull; a shape taller than `ABOVE_MIN_SHAPE_PX` at the tier's smallest
 * zoom carries it above its top edge, clear of its own notes. A selected
 * region always labels above.
 */
export function layoutRegionLabel(args: {
  region: UmapRegionItem;
  shape: RegionShape;
  tier: number;
  selected?: boolean;
}): RegionLabelLayout {
  const { region, shape } = args;
  const lines = wrapRegionTitle(region.title, 16, 3);
  const { width, height } = measureRegionLabelPx(lines);
  const shapeScreenHeight =
    (shape.bounds.maxY - shape.bounds.minY) * tierMinZoom(args.tier);
  const placement =
    args.selected || shapeScreenHeight > ABOVE_MIN_SHAPE_PX
      ? "above"
      : "center";
  return {
    regionId: region.id,
    lines,
    placement,
    anchorX: shape.center.x,
    anchorY: placement === "above" ? shape.bounds.minY : shape.center.y,
    box: {
      left: -width / 2,
      top: placement === "above" ? -height - ABOVE_GAP_PX : -height / 2,
      width,
      height,
    },
  };
}

/**
 * Region labels for the settled zoom. The plan depends only on the regions,
 * their shapes, and the zoom tier: never on pan or the live zoom. Regions
 * take labels in `order`, skipping any that would touch a label already
 * placed at the tier's smallest zoom, up to the tier's count. Because a
 * label shrinks in world units as zoom grows, the set stays overlap-free
 * across the whole tier. Every region gets a layout so a hovered, unlabeled
 * region can still show its name in place.
 */
export function planRegionLabels(args: {
  regions: UmapRegionItem[];
  shapes: Map<string, RegionShape>;
  order: string[];
  zoom: number;
  regionsOnly: boolean;
  selectedRegionId?: string;
}) {
  const tier = regionLabelTier(args.zoom);
  const minZoom = tierMinZoom(tier);
  const layouts = new Map<string, RegionLabelLayout>();
  for (const region of args.regions) {
    const shape = args.shapes.get(region.id);
    if (!shape) continue;
    layouts.set(
      region.id,
      layoutRegionLabel({
        region,
        shape,
        tier,
        selected: region.id === args.selectedRegionId,
      }),
    );
  }

  if (args.selectedRegionId) {
    return {
      tier,
      layouts,
      labeledIds: layouts.has(args.selectedRegionId)
        ? [args.selectedRegionId]
        : [],
    };
  }

  const maxCount = getVisibleRegionLabelCount({
    regionCount: args.regions.length,
    zoomScale: minZoom,
    regionsOnly: args.regionsOnly,
  });
  const placed: Bounds[] = [];
  const labeledIds: string[] = [];
  for (const regionId of args.order) {
    if (labeledIds.length >= maxCount) break;
    const layout = layouts.get(regionId);
    if (!layout) continue;
    const box = regionLabelWorldBox(layout, minZoom, LABEL_SPACING_PX / 2);
    if (placed.some((other) => overlaps(box, other))) continue;
    placed.push(box);
    labeledIds.push(regionId);
  }
  return { tier, layouts, labeledIds };
}
