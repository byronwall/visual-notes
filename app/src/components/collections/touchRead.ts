import { onCleanup, onMount } from "solid-js";

/**
 * Keeps a property list read-only to touch taps until `editing()` is true.
 * Taps that would start an edit are stopped before they reach a field. A tap
 * on a link field opens the link instead. Mouse and keyboard pass through.
 *
 * The read-only look is CSS under `(hover: none)`, so the server render and
 * the first client render match; this guard only adds the behavior.
 */
export const useTouchReadGuard = (
  root: () => HTMLElement | undefined,
  editing: () => boolean,
) => {
  onMount(() => {
    const el = root();
    if (!el) return;
    // Safari's click event may not carry pointerType, so remember the last one.
    let lastPointer = "";
    const onPointerDown = (e: PointerEvent) => (lastPointer = e.pointerType);
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (editing() || target.closest("a[href], [data-touch-allow]")) return;
      const pointer = (e as PointerEvent).pointerType || lastPointer;
      if (pointer !== "touch" || !matchMedia("(hover: none)").matches) return;
      e.stopPropagation();
      e.preventDefault();
      target
        .closest("[data-cell]")
        ?.querySelector<HTMLElement>("a[href]")
        ?.click();
    };
    el.addEventListener("pointerdown", onPointerDown, true);
    el.addEventListener("click", onClick, true);
    onCleanup(() => {
      el.removeEventListener("pointerdown", onPointerDown, true);
      el.removeEventListener("click", onClick, true);
    });
  });
};
