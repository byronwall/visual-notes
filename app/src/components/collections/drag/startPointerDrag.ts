/** Pixels the pointer must travel before a press becomes a drag (clicks stay clicks). */
const DRAG_THRESHOLD = 5;

export type PointerDragHandlers = {
  /** Called once the threshold is crossed; return false to cancel. */
  onStart?: () => boolean | void;
  onMove: (x: number, y: number) => void;
  onDrop: (x: number, y: number) => void;
  onCancel?: () => void;
};

/**
 * Starts tracking a press on `source`. A floating copy of the element follows
 * the pointer once the press moves past a small threshold; Escape cancels.
 * Returns true from the click guard while a drag just finished, so the
 * trailing click doesn't open the card.
 */
export function startPointerDrag(
  event: PointerEvent,
  source: HTMLElement,
  handlers: PointerDragHandlers,
) {
  if (event.button !== 0) return;
  const startX = event.clientX;
  const startY = event.clientY;
  const rect = source.getBoundingClientRect();
  const offsetX = startX - rect.left;
  const offsetY = startY - rect.top;
  let ghost: HTMLElement | null = null;
  let dragging = false;

  const cleanup = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("keydown", key, true);
    ghost?.remove();
    ghost = null;
    source.style.opacity = "";
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const move = (e: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD)
        return;
      if (handlers.onStart?.() === false) {
        cleanup();
        return;
      }
      dragging = true;
      ghost = source.cloneNode(true) as HTMLElement;
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
    const wasDragging = dragging;
    cleanup();
    if (!wasDragging) return;
    suppressNextClick(source);
    handlers.onDrop(e.clientX, e.clientY);
  };

  const key = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !dragging) return;
    e.preventDefault();
    e.stopPropagation();
    cleanup();
    handlers.onCancel?.();
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("keydown", key, true);
}

/** Swallows the click that browsers fire right after a drag ends. */
function suppressNextClick(el: HTMLElement) {
  const stop = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  el.addEventListener("click", stop, { capture: true, once: true });
  setTimeout(() => el.removeEventListener("click", stop, { capture: true }), 0);
}
