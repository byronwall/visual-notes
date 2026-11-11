import type { Accessor } from "solid-js";
import { ROW_HEIGHT } from "./useWindowedRows";

export type EditEndReason = "commit" | "cancel" | "tab" | "shift-tab";

/**
 * Spreadsheet keyboard moves for the table grid. Arrows clamp at the edges.
 * Tab and Shift+Tab wrap to the next or previous row, and leave the grid at
 * its first and last cell so keyboard users are never trapped.
 */
export function useGridKeys(opts: {
  viewId: () => string;
  rowCount: Accessor<number>;
  colCount: Accessor<number>;
  scroller: () => HTMLElement | undefined;
  /** Width of the frozen columns that cover the scroller's left edge. */
  frozenWidth: () => number;
  reveal: (rowIndex: number) => void;
  onEscape: () => void;
}) {
  const cellAt = (r: number, c: number) =>
    document.querySelector<HTMLElement>(
      `[data-grid="${opts.viewId()}"] [data-row-index="${r}"][data-col-index="${c}"]`,
    );

  /** Scrolls sideways so a cell is not hidden under the frozen columns. */
  const revealX = (holder: HTMLElement, c: number) => {
    const scroller = opts.scroller();
    if (!scroller) return;
    if (c === 0) {
      scroller.scrollLeft = 0;
      return;
    }
    const s = scroller.getBoundingClientRect();
    const r = holder.getBoundingClientRect();
    const left = s.left + opts.frozenWidth();
    const right = s.left + scroller.clientWidth;
    if (r.left < left) scroller.scrollLeft -= left - r.left;
    else if (r.right > right) scroller.scrollLeft += r.right - right;
  };

  const focusCell = (rowIndex: number, colIndex: number) => {
    const n = opts.rowCount();
    if (n === 0) return;
    const r = Math.max(0, Math.min(n - 1, rowIndex));
    const c = Math.max(0, Math.min(opts.colCount() - 1, colIndex));
    opts.reveal(r);
    queueMicrotask(() => {
      const holder = cellAt(r, c);
      if (!holder) return;
      revealX(holder, c);
      // Scrolling is handled above; the browser's own scroll-into-view would
      // move the page and the sticky header with it.
      holder.querySelector<HTMLElement>("[data-cell]")?.focus({
        preventScroll: true,
      });
    });
  };

  /** The next cell in reading order, or null past either end of the grid. */
  const step = (
    r: number,
    c: number,
    back: boolean,
  ): [number, number] | null => {
    const last = opts.colCount() - 1;
    if (back) {
      if (c > 0) return [r, c - 1];
      return r > 0 ? [r - 1, last] : null;
    }
    if (c < last) return [r, c + 1];
    return r < opts.rowCount() - 1 ? [r + 1, 0] : null;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (!target.matches("[data-cell]")) return;
    const holder = target.closest<HTMLElement>("[data-row-index]");
    if (!holder) return;
    const r = Number(holder.dataset.rowIndex);
    const c = Number(holder.dataset.colIndex);
    const height = opts.scroller()?.clientHeight ?? window.innerHeight;
    const page = Math.max(1, Math.floor(height / ROW_HEIGHT) - 2);
    const moves: Record<string, [number, number]> = {
      ArrowUp: [r - 1, c],
      ArrowDown: [r + 1, c],
      ArrowLeft: [r, c - 1],
      ArrowRight: [r, c + 1],
      PageUp: [r - page, c],
      PageDown: [r + page, c],
      Home: e.ctrlKey || e.metaKey ? [0, 0] : [r, 0],
      End:
        e.ctrlKey || e.metaKey
          ? [opts.rowCount() - 1, opts.colCount() - 1]
          : [r, opts.colCount() - 1],
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      focusCell(move[0], move[1]);
    } else if (e.key === "Tab" && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const next = step(r, c, e.shiftKey);
      if (!next) return;
      e.preventDefault();
      focusCell(next[0], next[1]);
    } else if (e.key === "Escape") {
      opts.onEscape();
    }
  };

  /** Moves on after an inline editor closes with Tab or Shift+Tab. */
  const onEditEnd = (r: number, c: number) => (reason: EditEndReason) => {
    if (reason !== "tab" && reason !== "shift-tab") return;
    // Past either end the editor has already refocused its own cell.
    const next = step(r, c, reason === "shift-tab");
    if (next) focusCell(next[0], next[1]);
  };

  return { focusCell, onKeyDown, onEditEnd };
}
