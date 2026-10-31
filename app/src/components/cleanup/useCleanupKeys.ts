import { onCleanup, onMount } from "solid-js";

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
  );
};

const button = (action: string) => {
  const el = document.querySelector<HTMLButtonElement>(
    `[data-cleanup-action="${action}"]:not([disabled])`,
  );
  // Below `lg` the queue view keeps the note mounted but hidden.
  return el?.offsetParent ? el : null;
};

const click = (action: string) => button(action)?.click();

/**
 * Triage keys: J/K or arrows move, Enter approves, E keeps, S (or →) skips,
 * Z snoozes (daily stack).
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
      (el.getAttribute("role") !== "option" || !button("primary"))
    ) {
      return;
    }
    if (key === "j" || key === "arrowdown") move(1);
    else if (key === "k" || key === "arrowup") move(-1);
    else if (key === "enter") click("primary");
    else if (key === "e") click("keep");
    else if (key === "s" || key === "arrowright") click("skip");
    else if (key === "z") click("snooze");
    else return;
    event.preventDefault();
  };
  onMount(() => window.addEventListener("keydown", onKey));
  onCleanup(() => {
    if (typeof window !== "undefined")
      window.removeEventListener("keydown", onKey);
  });
}
