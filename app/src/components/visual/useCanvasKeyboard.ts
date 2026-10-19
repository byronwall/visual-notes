import { onCleanup, onMount } from "solid-js";

const PAN_STEP_PX = 80;
const ZOOM_STEP = 1.4;

export type CanvasKeyboardActions = {
  focusSearch: () => void;
  fit: () => void;
  zoomBy: (factor: number) => void;
  resetZoom: () => void;
  panBy: (dx: number, dy: number) => void;
  toggleRegionsOnly: () => void;
  /** Steps back one level (search, then region); returns whether it handled Escape. */
  escape: () => boolean;
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

/** Canvas shortcuts. Keys typed inside inputs, editors, or the note panel are ignored. */
export function useCanvasKeyboard(actions: CanvasKeyboardActions) {
  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      if (
        event.target instanceof Element &&
        event.target.closest('[role="dialog"]')
      ) {
        return;
      }
      if (event.key === "Escape") {
        if (actions.escape()) event.preventDefault();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const step = event.shiftKey ? PAN_STEP_PX * 3 : PAN_STEP_PX;
      const handled = (() => {
        switch (event.key) {
          case "/":
            actions.focusSearch();
            return true;
          case "f":
          case "F":
          case "0":
            actions.fit();
            return true;
          case "+":
          case "=":
            actions.zoomBy(ZOOM_STEP);
            return true;
          case "-":
          case "_":
            actions.zoomBy(1 / ZOOM_STEP);
            return true;
          case "1":
            actions.resetZoom();
            return true;
          case "r":
          case "R":
            actions.toggleRegionsOnly();
            return true;
          case "ArrowLeft":
            actions.panBy(step, 0);
            return true;
          case "ArrowRight":
            actions.panBy(-step, 0);
            return true;
          case "ArrowUp":
            actions.panBy(0, step);
            return true;
          case "ArrowDown":
            actions.panBy(0, -step);
            return true;
          default:
            return false;
        }
      })();
      if (handled) event.preventDefault();
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });
}
