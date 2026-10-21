import type { Point } from "./label-geometry";

export type CanvasView = { zoom: number; offset: Point };

/** Quiet time after the last view change before labels re-plan. */
export const SETTLE_IDLE_MS = 200;
/** Zoom changes under 0.5% (relative) do not re-plan labels. */
const MIN_RELATIVE_ZOOM_CHANGE = 0.005;
/** Pans under one screen pixel do not re-plan labels. */
const MIN_PAN_PX = 1;

/**
 * Whether `next` differs enough from `settled` to re-plan labels. Zoom is
 * compared as a ratio, so the threshold means the same at 0.3× and at 4×.
 */
export function isSignificantViewChange(settled: CanvasView, next: CanvasView) {
  const zoomRatio = Math.abs(Math.log(next.zoom / settled.zoom));
  if (zoomRatio >= Math.log1p(MIN_RELATIVE_ZOOM_CHANGE)) return true;
  return (
    Math.hypot(
      next.offset.x - settled.offset.x,
      next.offset.y - settled.offset.y,
    ) >= MIN_PAN_PX
  );
}

/**
 * Holds the view labels are planned for. Every live view change restarts
 * an idle timer; the gate commits only once the view has been still for
 * `SETTLE_IDLE_MS`. There is no max-wait, so a long gesture never changes
 * which labels show partway through.
 */
export class SettledViewGate {
  settled: CanvasView;
  private pending: CanvasView | undefined;
  private lastChangeAt = 0;

  constructor(initial: CanvasView) {
    this.settled = initial;
  }

  /** Record a live view at `now`. Returns true when a commit is pending. */
  observe(view: CanvasView, now: number) {
    if (!isSignificantViewChange(this.pending ?? this.settled, view)) {
      return this.pending !== undefined;
    }
    this.pending = view;
    this.lastChangeAt = now;
    return true;
  }

  /** Commit the pending view if it has been idle long enough. */
  tick(now: number) {
    if (!this.pending || now - this.lastChangeAt < SETTLE_IDLE_MS) {
      return undefined;
    }
    const next = this.pending;
    this.pending = undefined;
    if (!isSignificantViewChange(this.settled, next)) return undefined;
    this.settled = next;
    return next;
  }

  get hasPending() {
    return this.pending !== undefined;
  }

  /** Milliseconds until a pending view could commit. */
  msUntilCommit(now: number) {
    return Math.max(0, SETTLE_IDLE_MS - (now - this.lastChangeAt));
  }
}
