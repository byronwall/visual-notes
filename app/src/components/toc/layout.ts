import {
  MIN_RAIL_HEIGHT,
  PINNED_GAP,
  PINNED_MAX_WIDTH,
  PINNED_MIN_WIDTH,
  RAIL_WIDTH,
  RIGHT_GAP,
  VIEWPORT_PADDING,
} from "./constants";
import { type TocLayout } from "./types";
import { clamp } from "./utils";

export function computeTocLayout(
  root: HTMLElement,
  itemCount: number,
): TocLayout {
  const rect = root.getBoundingClientRect();
  const pinnedLeft = rect.right + PINNED_GAP;
  const pinnedRoom = window.innerWidth - VIEWPORT_PADDING - pinnedLeft;
  const railHeightPx = clamp(
    20 + itemCount * 28,
    MIN_RAIL_HEIGHT,
    Math.max(MIN_RAIL_HEIGHT, window.innerHeight - 120),
  );

  if (pinnedRoom >= PINNED_MIN_WIDTH) {
    return {
      mode: "pinned",
      leftPx: Math.round(pinnedLeft),
      widthPx: Math.round(Math.min(PINNED_MAX_WIDTH, pinnedRoom)),
      railHeightPx,
    };
  }

  return {
    mode: "rail",
    // Hug the screen edge when the gutter is tight, so the rail stays off
    // the text for as long as it fits.
    leftPx: Math.round(
      Math.max(
        Math.min(rect.right + RIGHT_GAP, window.innerWidth - RAIL_WIDTH - 2),
        Math.min(
          rect.right + 2,
          window.innerWidth - VIEWPORT_PADDING - RAIL_WIDTH,
        ),
      ),
    ),
    widthPx: RAIL_WIDTH,
    railHeightPx,
  };
}

export function getEffectiveContentHeight(root: HTMLElement): number {
  const rootTop = root.getBoundingClientRect().top + window.scrollY;
  const blocks = Array.from(
    root.querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,table,hr,img,video,code",
    ),
  );

  let maxBottom = 0;

  for (const block of blocks) {
    if (block.offsetHeight <= 0) continue;

    const text = (block.textContent || "").trim();
    const hasRenderableContent =
      text.length > 0 ||
      block.querySelector(
        "img,video,table,pre,code,hr,blockquote,iframe,svg",
      ) !== null;
    if (!hasRenderableContent) continue;

    const blockBottom =
      block.getBoundingClientRect().bottom + window.scrollY - rootTop;
    if (blockBottom > maxBottom) {
      maxBottom = blockBottom;
    }
  }

  if (maxBottom <= 0) {
    return Math.max(root.scrollHeight, 1);
  }

  return Math.max(maxBottom, 1);
}

export function distributeMarkerRatios(
  raw: number[],
  min: number,
  max: number,
  minGap: number,
) {
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
