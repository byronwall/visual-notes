import { getEffectiveContentHeight, distributeMarkerRatios } from "./layout";
import { type TocItem, type TocMarker } from "./types";
import { clamp } from "./utils";

export function computeMarkers(params: {
  items: TocItem[];
  root: HTMLElement | null;
  railHeightPx: number;
  resolveHeadingEl: (item: TocItem) => HTMLElement | null;
}): TocMarker[] {
  const { items, root, railHeightPx, resolveHeadingEl } = params;
  if (items.length === 0) return [];

  const railInnerHeightPx = Math.max(railHeightPx - 6, 1);
  const maxMarkerHeightPx = 7;
  const edgePaddingPx = maxMarkerHeightPx / 2 + 1;
  const edgeRatio = clamp(edgePaddingPx / railInnerHeightPx, 0.02, 0.1);

  if (!root) {
    const fallbackSpan = 1 / items.length;
    const fallbackRaw = items.map((_, index) =>
      items.length === 1 ? 0.5 : index / (items.length - 1)
    );
    const fallbackDisplay = distributeMarkerRatios(
      fallbackRaw,
      edgeRatio,
      1 - edgeRatio,
      clamp(5 / railInnerHeightPx, 0.004, 0.02)
    );

    return items.map((item, index) => ({
      item,
      index,
      topRatio: items.length === 1 ? 0 : index / (items.length - 1),
      displayTopRatio: fallbackDisplay[index],
      spanRatio: fallbackSpan,
    }));
  }

  const rootTop = root.getBoundingClientRect().top + window.scrollY;
  const docHeight = getEffectiveContentHeight(root);

  const headingTops = items.map((item, index) => {
    const el = resolveHeadingEl(item);
    if (!el) {
      return items.length === 1 ? 0 : (index / (items.length - 1)) * docHeight;
    }
    const absoluteTop = el.getBoundingClientRect().top + window.scrollY;
    return clamp(absoluteTop - rootTop, 0, docHeight);
  });

  const rawSpans = headingTops.map((top, index) => {
    const nextTop = index === headingTops.length - 1 ? docHeight : headingTops[index + 1];
    return Math.max(nextTop - top, docHeight * 0.02);
  });

  const spanTotal = rawSpans.reduce((sum, value) => sum + value, 0) || 1;
  const rawDisplay = items.map((_, index) => clamp(headingTops[index] / docHeight, 0, 1));
  const minGap = clamp(5 / railInnerHeightPx, 0.004, 0.02);
  const distributed = distributeMarkerRatios(rawDisplay, edgeRatio, 1 - edgeRatio, minGap);

  return items.map((item, index) => ({
    item,
    index,
    topRatio: clamp(headingTops[index] / docHeight, 0, 1),
    displayTopRatio: distributed[index],
    spanRatio: clamp(rawSpans[index] / spanTotal, 0.02, 0.35),
  }));
}

export function computeVisibleMarkerBounds(markers: TocMarker[], start: number, end: number) {
  if (markers.length === 0) {
    return { topRatio: 0.02, bottomRatio: 0.98 };
  }

  const startIdx = clamp(start, 0, markers.length - 1);
  const endIdx = clamp(end, startIdx, markers.length - 1);
  const topRatio = markers[startIdx]?.displayTopRatio ?? 0.02;
  const bottomRatio = markers[endIdx]?.displayTopRatio ?? 0.98;

  return {
    topRatio: clamp(Math.min(topRatio, bottomRatio), 0.02, 0.98),
    bottomRatio: clamp(Math.max(topRatio, bottomRatio), 0.02, 0.98),
  };
}
