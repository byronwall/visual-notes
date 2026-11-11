import { onCleanup, onMount } from "solid-js";

/**
 * On a phone the table is for reading and moving around, not typing: the
 * software keyboard covers most of the screen. A touch tap on a body cell
 * opens the record in the peek panel instead of an inline editor. Mouse and
 * keyboard editing are unchanged. Links in cells and the row checkboxes keep
 * working on touch.
 */
export function useTouchTaps(
  openRow: (rowId: string) => void,
  grid: () => HTMLElement | undefined,
) {
  // The last pointer used anywhere on the page, so the toolbar's New button
  // also knows a finger pressed it.
  let lastPointer = "";

  const isTouch = () =>
    lastPointer === "touch" ||
    (lastPointer === "" && matchMedia("(hover: none)").matches);

  /** Capture-phase click on the grid: reroutes touch taps on body cells. */
  const onClick = (e: MouseEvent) => {
    const type = (e as PointerEvent).pointerType || lastPointer;
    if (type !== "touch") return;
    const target = e.target as HTMLElement;
    if (!target.closest("[role='gridcell'][data-row-index]")) return;
    if (target.closest("a[href]")) return;
    const rowId = target.closest<HTMLElement>("[data-row-id]")?.dataset.rowId;
    if (!rowId) return;
    e.preventDefault();
    e.stopPropagation();
    openRow(rowId);
  };

  onMount(() => {
    const track = (e: PointerEvent) => (lastPointer = e.pointerType);
    window.addEventListener("pointerdown", track, {
      capture: true,
      passive: true,
    });
    // Capture phase, so it runs before the cells' own click handlers.
    const el = grid()!;
    el.addEventListener("click", onClick, { capture: true });
    onCleanup(() => {
      window.removeEventListener("pointerdown", track, { capture: true });
      el.removeEventListener("click", onClick, { capture: true });
    });
  });

  return { isTouch };
}
