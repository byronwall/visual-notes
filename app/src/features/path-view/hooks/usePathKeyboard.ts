import { onCleanup, onMount } from "solid-js";

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
};

/**
 * Page-level shortcuts for the path view:
 * j/k or arrows move, Enter opens, / focuses the filter, n creates a note.
 */
export const usePathKeyboard = (handlers: {
  move: (delta: number) => void;
  /** Arrow keys only drive the list once a row is active, so they still scroll otherwise. */
  hasActive: () => boolean;
  open: (newTab: boolean) => void;
  focusFilter: () => void;
  createNote?: () => void;
}) => {
  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey) return;
      if (isTypingTarget(event.target)) return;
      if (document.querySelector("[role=dialog][data-state=open]")) return;
      if (event.metaKey && event.key !== "Enter") return;

      switch (event.key) {
        case "ArrowDown":
        case "ArrowUp":
          if (!handlers.hasActive()) return;
          event.preventDefault();
          handlers.move(event.key === "ArrowDown" ? 1 : -1);
          break;
        case "j":
        case "k":
          event.preventDefault();
          handlers.move(event.key === "j" ? 1 : -1);
          break;
        case "Enter":
          if (!handlers.hasActive()) return;
          // Let a focused link or button do its own thing.
          if (event.target instanceof Element && event.target.closest("a, button, [role=button]")) return;
          event.preventDefault();
          handlers.open(event.metaKey);
          break;
        case "/":
          event.preventDefault();
          handlers.focusFilter();
          break;
        case "n":
          if (!handlers.createNote) return;
          event.preventDefault();
          handlers.createNote();
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });
};
