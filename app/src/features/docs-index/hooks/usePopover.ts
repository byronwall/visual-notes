import { createSignal, createEffect, onCleanup } from "solid-js";

export function usePopover() {
  const [open, setOpen] = createSignal(false);
  let anchorEl: HTMLElement | undefined;
  let popoverEl: HTMLElement | undefined;

  const setAnchor = (el: HTMLElement | undefined) => {
    anchorEl = el;
  };
  const setPopover = (el: HTMLElement | undefined) => {
    popoverEl = el;
  };

  const openPopover = () => setOpen(true);
  const closePopover = () => setOpen(false);
  const togglePopover = () => setOpen((v) => !v);

  createEffect(() => {
    if (!open()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopover();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  createEffect(() => {
    if (!open()) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverEl &&
        !popoverEl.contains(target) &&
        anchorEl &&
        !anchorEl.contains(target)
      ) {
        closePopover();
      }
    };
    window.addEventListener("mousedown", onDoc);
    onCleanup(() => window.removeEventListener("mousedown", onDoc));
  });

  return {
    open,
    openPopover,
    closePopover,
    togglePopover,
    setAnchor,
    setPopover,
  };
}
