import { createEffect, onCleanup } from "solid-js";

const PANEL = '[role="dialog"][aria-label="Document details"]';
// A swipe must travel this far, mostly sideways, to count as a move.
const SWIPE_MIN_PX = 60;
const SWIPE_MAX_MS = 700;
// Swipes that start this close to a screen edge belong to the browser.
const EDGE_PX = 24;

const isEditable = (el: Element | null) =>
  !!el?.closest(
    'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]',
  );

const hasSelection = () => {
  const sel = window.getSelection();
  return !!sel && !sel.isCollapsed;
};

/** True inside something that scrolls sideways (a wide table, a code block). */
const inSideScroller = (el: Element | null, stop: Element | null) => {
  for (let node = el; node && node !== stop; node = node.parentElement) {
    if (node.scrollWidth <= node.clientWidth) continue;
    const { overflowX } = getComputedStyle(node);
    if (overflowX === "auto" || overflowX === "scroll") return true;
  }
  return false;
};

/**
 * Moves between records with the keyboard (Alt+Arrow, or J/K outside a text
 * field) and with a sideways swipe on the panel. The listeners never call
 * preventDefault on touch, so vertical scroll and text selection work as before.
 */
export const useRecordGestures = (opts: {
  active: () => boolean;
  prev: () => void;
  next: () => void;
}) => {
  createEffect(() => {
    if (!opts.active()) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      const target = e.target instanceof Element ? e.target : null;
      // Menus, pickers, and other dialogs keep their own keys.
      const layer = target?.closest(
        '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
      );
      if (layer && !layer.matches(PANEL)) return;
      let step = 0;
      if (e.altKey && !e.shiftKey) {
        if (e.key === "ArrowUp") step = -1;
        if (e.key === "ArrowDown") step = 1;
      } else if (!e.altKey && !e.shiftKey && !isEditable(target)) {
        const key = e.key.toLowerCase();
        if (key === "k") step = -1;
        if (key === "j") step = 1;
      }
      if (!step) return;
      e.preventDefault();
      if (step < 0) opts.prev();
      else opts.next();
    };

    let start: { x: number; y: number; at: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1) return;
      const target = e.target instanceof Element ? e.target : null;
      const panel = target?.closest(PANEL);
      if (!panel || isEditable(document.activeElement)) return;
      const touch = e.touches[0];
      if (touch.clientX < EDGE_PX || touch.clientX > innerWidth - EDGE_PX)
        return;
      if (inSideScroller(target, panel)) return;
      start = { x: touch.clientX, y: touch.clientY, at: e.timeStamp };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) start = null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const from = start;
      start = null;
      const touch = e.changedTouches[0];
      if (!from || !touch || hasSelection()) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (e.timeStamp - from.at > SWIPE_MAX_MS) return;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < 2 * Math.abs(dy))
        return;
      if (dx < 0) opts.next();
      else opts.prev();
    };

    const passive = { passive: true } as const;
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, passive);
    window.addEventListener("touchmove", onTouchMove, passive);
    window.addEventListener("touchend", onTouchEnd, passive);
    onCleanup(() => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    });
  });
};
