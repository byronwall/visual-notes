import type { UmapRegionItem } from "~/features/umap/region-types";
import {
  clamp,
  snapWorldCoordinate,
  type Bounds,
  type LabelTextAnchor,
  type Point,
} from "./label-geometry";

/** Zoom at which a selected region's label may sit inside its own circle. */
export const SELECTED_REGION_INSIDE_LABEL_ZOOM = 4.25;

export type RegionLabelLayout = {
  regionId: string;
  lines: string[];
  textAnchor: LabelTextAnchor;
  textX: number;
  textY: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  showLeader: boolean;
  leaderEndX: number;
  leaderEndY: number;
  elbowX: number;
  elbowY: number;
  edgeX: number;
  edgeY: number;
};

/** Region circles never draw smaller than this world radius. */
export const regionDrawRadius = (region: { radius: number }) =>
  Math.max(18, region.radius);

/** Width and height of a region label's text block in world units. */
export function measureRegionLabel(args: {
  lines: string[];
  zoomScale: number;
  labelFontSize: number;
}) {
  const lineHeight = args.labelFontSize * 0.86;
  const labelWidth = Math.max(
    70 / args.zoomScale,
    Math.max(...args.lines.map((line) => line.length), 8) *
      args.labelFontSize *
      0.42,
  );
  const labelHeight = args.lines.length * lineHeight + 4 / args.zoomScale;
  return { labelWidth, labelHeight };
}

export function snapRegionLabelLayout<
  T extends {
    textAnchor: LabelTextAnchor;
    textX: number;
    textY: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    leaderEndX: number;
    leaderEndY: number;
    elbowX: number;
    elbowY: number;
    edgeX: number;
    edgeY: number;
  },
>(layout: T, args: { zoomScale: number; offset: Point }) {
  const snapX = (value: number) =>
    snapWorldCoordinate(value, args.zoomScale, args.offset.x);
  const snapY = (value: number) =>
    snapWorldCoordinate(value, args.zoomScale, args.offset.y);
  return {
    ...layout,
    textX: snapX(layout.textX),
    textY: snapY(layout.textY),
    minX: snapX(layout.minX),
    minY: snapY(layout.minY),
    maxX: snapX(layout.maxX),
    maxY: snapY(layout.maxY),
    leaderEndX: snapX(layout.leaderEndX),
    leaderEndY: snapY(layout.leaderEndY),
    elbowX: snapX(layout.elbowX),
    elbowY: snapY(layout.elbowY),
    edgeX: snapX(layout.edgeX),
    edgeY: snapY(layout.edgeY),
  };
}

/**
 * Squared depth by which `box` cuts into its own region circle and into
 * every other region circle.
 */
export function measureRegionBoxContest(args: {
  box: Bounds;
  regions: UmapRegionItem[];
  regionId: string;
  zoomScale: number;
}) {
  let selfOverlap = 0;
  let otherOverlap = 0;
  for (const other of args.regions) {
    const pad =
      other.id === args.regionId ? 2 / args.zoomScale : 8 / args.zoomScale;
    const closestX = clamp(other.centroid.x, args.box.minX, args.box.maxX);
    const closestY = clamp(other.centroid.y, args.box.minY, args.box.maxY);
    const dx = other.centroid.x - closestX;
    const dy = other.centroid.y - closestY;
    const gap =
      Math.sqrt(dx * dx + dy * dy) - (Math.max(18, other.radius) + pad);
    if (gap < 0) {
      if (other.id === args.regionId) selfOverlap += gap * gap;
      else otherOverlap += gap * gap;
    }
  }
  return { selfOverlap, otherOverlap };
}
