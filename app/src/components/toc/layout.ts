import {
  IDEAL_PANEL_WIDTH,
  MAX_PANEL_WIDTH,
  MIN_RAIL_HEIGHT,
  PANEL_GAP,
  RAIL_WIDTH,
  RIGHT_GAP,
  VIEWPORT_PADDING,
} from "./constants";
import { type TocLayout } from "./types";
import { clamp } from "./utils";

export function getViewportMaxHeightPx(maxVh: number) {
  return Math.max(
    MIN_RAIL_HEIGHT,
    Math.floor(Math.min(window.innerHeight - 24, window.innerHeight * (maxVh / 100)))
  );
}

export function getPanelMaxHeightCss(maxVh: number) {
  return `min(calc(100vh - 0.75rem), ${maxVh}vh)`;
}

export function computeTocLayout(root: HTMLElement, maxVh: number, itemCount: number): TocLayout {
  const rect = root.getBoundingClientRect();

  const railLeft = clamp(
    rect.right + RIGHT_GAP,
    VIEWPORT_PADDING + RAIL_WIDTH,
    window.innerWidth - VIEWPORT_PADDING - RAIL_WIDTH
  );

  const maxUsablePanelWidth = Math.max(120, window.innerWidth - VIEWPORT_PADDING * 2);
  const panelWidthPx = Math.min(MAX_PANEL_WIDTH, maxUsablePanelWidth);

  const desiredPanelLeft = railLeft + RAIL_WIDTH + PANEL_GAP;
  const clampedPanelLeft = clamp(
    desiredPanelLeft,
    VIEWPORT_PADDING,
    window.innerWidth - VIEWPORT_PADDING - panelWidthPx
  );

  const idealRailLeft = rect.right + RIGHT_GAP;
  const compactAtRest = railLeft < idealRailLeft - 1;

  const rightPanelRoom = window.innerWidth - VIEWPORT_PADDING - desiredPanelLeft;
  const showExpandedByDefault =
    rightPanelRoom >= panelWidthPx && rightPanelRoom >= IDEAL_PANEL_WIDTH;

  const viewportMaxHeightPx = getViewportMaxHeightPx(maxVh);
  const railHeightPx = clamp(20 + itemCount * 32, MIN_RAIL_HEIGHT, viewportMaxHeightPx);

  return {
    panelLeftPx: railLeft,
    panelWidthPx,
    panelOffsetPx: clampedPanelLeft - railLeft,
    railHeightPx,
    compactAtRest,
    showExpandedByDefault,
  };
}

export function getEffectiveContentHeight(root: HTMLElement): number {
  const rootTop = root.getBoundingClientRect().top + window.scrollY;
  const blocks = Array.from(
    root.querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,table,hr,img,video,code"
    )
  );

  let maxBottom = 0;

  for (const block of blocks) {
    if (block.offsetHeight <= 0) continue;

    const text = (block.textContent || "").trim();
    const hasRenderableContent =
      text.length > 0 ||
      block.querySelector("img,video,table,pre,code,hr,blockquote,iframe,svg") !== null;
    if (!hasRenderableContent) continue;

    const blockBottom = block.getBoundingClientRect().bottom + window.scrollY - rootTop;
    if (blockBottom > maxBottom) {
      maxBottom = blockBottom;
    }
  }

  if (maxBottom <= 0) {
    return Math.max(root.scrollHeight, 1);
  }

  return Math.max(maxBottom, 1);
}

export function distributeMarkerRatios(raw: number[], min: number, max: number, minGap: number) {
  if (raw.length === 0) return [];

  const clamped = raw.map((value) => clamp(value, min, max));
  const forward: number[] = [];

  for (const value of clamped) {
    if (forward.length === 0) {
      forward.push(value);
      continue;
    }
    forward.push(Math.max(value, forward[forward.length - 1] + minGap));
  }

  for (let i = forward.length - 1; i >= 0; i--) {
    const maxForIndex = max - (forward.length - 1 - i) * minGap;
    forward[i] = Math.min(forward[i], maxForIndex);
    if (i > 0 && forward[i] - forward[i - 1] < minGap) {
      forward[i - 1] = forward[i] - minGap;
    }
  }

  return forward.map((value) => clamp(value, min, max));
}
