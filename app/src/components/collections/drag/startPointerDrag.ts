import { css } from "styled-system/css";

/** Pixels the pointer must travel before a press becomes a drag (clicks stay clicks). */
const DRAG_THRESHOLD = 5;
/** A touch must hold this long before it lifts the card; a quicker swipe scrolls. */
const PRESS_MS = 350;
/** Finger travel allowed during the hold before it counts as a scroll. */
const PRESS_SLOP = 8;

export type PointerDragHandlers = {
  /** Called once the threshold is crossed; return false to cancel. */
  onStart?: () => boolean | void;
  onMove: (x: number, y: number) => void;
  onDrop: (x: number, y: number) => void;
  onCancel?: () => void;
  /** A touch held and released without moving (opens a card menu). */
  onLongPress?: () => void;
};

// True while a touch has lifted a card, so the page must not scroll.
let holding = false;
let guarded = false;
/**
 * iOS honours preventDefault on touchmove only from a listener that existed
 * before the touch began, so one non-passive listener stays installed.
 */
function guardTouchScroll() {
  if (guarded) return;
  guarded = true;
  window.addEventListener(
    "touchmove",
    (e) => {
      if (holding) e.preventDefault();
    },
    { passive: false },
  );
}

/**
 * Starts tracking a press on `source`. Mouse and pen drag once the press
 * moves past a small threshold. Touch drags only after a long-press, so a
 * swipe that starts on a card still scrolls. A floating copy of the element
 * follows the pointer; Escape or a pointercancel restores everything.
 */
export function startPointerDrag(
  event: PointerEvent,
  source: HTMLElement,
  handlers: PointerDragHandlers,
) {
  if (event.button !== 0) return;
  const touch = event.pointerType === "touch";
  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  const rect = source.getBoundingClientRect();
  const offsetX = startX - rect.left;
  const offsetY = startY - rect.top;
  let ghost: HTMLElement | null = null;
  let dragging = false;
  // Mouse and pen may drag at once; touch waits for the long-press.
  let armed = !touch;
  let timer: ReturnType<typeof setTimeout> | undefined;

  if (touch) {
    guardTouchScroll();
    timer = setTimeout(() => {
      armed = true;
      holding = true;
      source.dataset.lifted = "";
      navigator.vibrate?.(10);
    }, PRESS_MS);
  }

  const cleanup = () => {
    clearTimeout(timer);
    holding = false;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
    source.removeEventListener("contextmenu", noMenu);
    ghost?.remove();
    ghost = null;
    delete source.dataset.lifted;
    source.style.opacity = "";
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const move = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (!dragging) {
      if (!armed) {
        // Moved before the hold finished: this is a scroll, not a drag.
        if (dist > PRESS_SLOP) cleanup();
        return;
      }
      if (dist < DRAG_THRESHOLD) return;
      if (handlers.onStart?.() === false) {
        cleanup();
        return;
      }
      dragging = true;
      ghost = source.cloneNode(true) as HTMLElement;
      delete ghost.dataset.lifted;
      Object.assign(ghost.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: `${rect.width}px`,
        pointerEvents: "none",
        zIndex: "9999",
        opacity: "0.92",
        transform: "rotate(1.5deg)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
      });
      document.body.appendChild(ghost);
      source.style.opacity = "0.35";
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    }
    if (ghost)
      ghost.style.transform = `translate(${e.clientX - offsetX}px, ${e.clientY - offsetY}px) rotate(1.5deg)`;
    handlers.onMove(e.clientX, e.clientY);
  };

  const up = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    const wasDragging = dragging;
    const longPress = touch && armed && !dragging;
    cleanup();
    if (wasDragging) {
      suppressNextClick();
      handlers.onDrop(e.clientX, e.clientY);
    } else if (longPress) {
      suppressNextClick();
      handlers.onLongPress?.();
    }
  };

  // The browser took the gesture (a scroll, a system gesture): drop nothing.
  const cancel = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    const wasDragging = dragging;
    cleanup();
    if (wasDragging) handlers.onCancel?.();
  };

  const key = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !dragging) return;
    e.preventDefault();
    e.stopPropagation();
    cleanup();
    handlers.onCancel?.();
  };

  // A held touch opens the browser's context menu on Android; the card menu replaces it.
  const noMenu = (e: Event) => e.preventDefault();

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key, true);
  if (touch) source.addEventListener("contextmenu", noMenu);
}

/**
 * Swallows the click that browsers fire right after a drag or long-press
 * ends. It listens on the window: a menu that opened under the finger can
 * be the click's target, not the card.
 */
function suppressNextClick() {
  const stop = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  const done = () => {
    window.removeEventListener("click", stop, { capture: true });
    window.removeEventListener("pointerdown", done, { capture: true });
  };
  window.addEventListener("click", stop, { capture: true, once: true });
  // A new press means the stray click is not coming; let its click through.
  window.addEventListener("pointerdown", done, { capture: true, once: true });
  // A touch's synthetic click can arrive a few frames after the release.
  setTimeout(done, 300);
}

/**
 * Class for draggable items: native pans keep scrolling, a held touch shows
 * a lifted state, and iOS shows no callout or text selection.
 */
export const draggable = css({
  touchAction: "pan-x pan-y",
  WebkitTouchCallout: "none",
  userSelect: "none",
  transitionProperty: "transform, box-shadow",
  transitionDuration: "140ms",
  "&[data-lifted]": { transform: "scale(1.02)", boxShadow: "md" },
});
