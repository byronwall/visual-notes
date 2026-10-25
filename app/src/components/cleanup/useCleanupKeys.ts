import { onCleanup, onMount } from "solid-js";

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
  );
};

const click = (action: string) =>
  document
    .querySelector<HTMLButtonElement>(
      `[data-cleanup-action="${action}"]:not([disabled])`,
    )
    ?.click();

/**
 * Triage keys: J/K or arrows move, Enter approves, E keeps, S skips.
 * Approve, keep, and skip click the visible action buttons so the keys and
 * the mouse always do the same thing.
 */
export function useCleanupKeys(move: (delta: number) => void) {
  const onKey = (event: KeyboardEvent) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      isTyping(event.target)
    ) {
      return;
    }
    const key = event.key.toLowerCase();
    // Enter on a focused action button already clicks it; on a queue row it
    // approves the selected note.
    const el = event.target as HTMLElement;
    if (
      key === "enter" &&
      el.tagName === "BUTTON" &&
      el.getAttribute("role") !== "option"
    ) {
      return;
    }
    if (key === "j" || key === "arrowdown") move(1);
    else if (key === "k" || key === "arrowup") move(-1);
    else if (key === "enter") click("primary");
    else if (key === "e") click("keep");
    else if (key === "s") click("skip");
    else return;
    event.preventDefault();
  };
  onMount(() => window.addEventListener("keydown", onKey));
  onCleanup(() => {
    if (typeof window !== "undefined")
      window.removeEventListener("keydown", onKey);
  });
}
