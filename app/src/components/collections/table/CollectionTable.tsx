import { For, Show, createMemo, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { applyView } from "~/lib/collections/query";
import type { CollectionView } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import { BulkBar } from "./BulkBar";
import { TableActions } from "./TableActions";
import { TableFooterRow } from "./TableFooterRow";
import { TableHeaderRow } from "./TableHeaderRow";
import { TableRow } from "./TableRow";
import { useColumns } from "./useColumns";
import { useGridKeys } from "./useGridKeys";
import { useRowSelection } from "./useRowSelection";
import { useScrollerFit } from "./useScrollerFit";
import { useTouchTaps } from "./useTouchTaps";
import {
  ROW_HEIGHT,
  WINDOW_THRESHOLD,
  useWindowedRows,
} from "./useWindowedRows";

const EMBED_ROW_LIMIT = 25;

const scrollerBase = {
  borderTopWidth: "1px",
  borderColor: "border",
  // The grid's name column and the empty state size against this width.
  containerType: "inline-size",
} as const;
const scroller = css({
  ...scrollerBase,
  overflowX: "auto",
  overflowY: "visible",
});
// On a collection page the table scrolls inside itself so the header and
// footer can stick; horizontal overflow would otherwise defeat vertical sticky.
// The max height is measured after mount; this fallback covers the first paint.
const pageScroller = css({
  ...scrollerBase,
  overflow: "auto",
  maxH: "calc(100dvh - 12rem)",
  overscrollBehavior: "contain",
  // Momentum scrolling on iOS; vertical and sideways pans both stay inside.
  WebkitOverflowScrolling: "touch",
  // Windowing swaps rows and spacers itself; browser scroll anchoring would
  // fight it and jump the scroll position.
  overflowAnchor: "none",
});
// Says that more columns sit past the right edge, mainly on a phone.
const edgeFade = css({
  position: "absolute",
  top: "0",
  right: "0",
  bottom: "0",
  w: "8",
  zIndex: "4",
  pointerEvents: "none",
  opacity: "0",
  background:
    "linear-gradient(to right, transparent, token(colors.bg.default))",
  transition: "opacity 140ms",
  "&[data-on]": { opacity: "1" },
});
const grid = css({
  display: "grid",
  minW: "max-content",
  fontSize: "sm",
  position: "relative",
  "--title-col": "var(--title-saved)",
  // A finger drag scrolls the table; it should not start a text selection
  // or flash a tap highlight on the cells it crosses.
  "@media (hover: none)": {
    userSelect: "none",
    WebkitTouchCallout: "none",
    WebkitTapHighlightColor: "transparent",
  },
  // Keep in step with useColumns.widthOf: a narrow table gives the name
  // column at most 40% of its width so the data stays readable.
  "@container (max-width: 639.98px)": {
    "--title-col": "min(var(--title-saved), max(120px, 40cqw))",
  },
});

/** Spreadsheet-style view: one row per note, one column per property. */
export const CollectionTable = (props: {
  view: CollectionView;
  /** Receives the action behind the toolbar's New button. */
  addRef?: (add: () => void) => void;
}) => {
  const { store, embedded, openRow } = useCollection();
  const [autoEditRowId, setAutoEditRowId] = createSignal<string | null>(null);
  const [limit, setLimit] = createSignal(
    embedded ? EMBED_ROW_LIMIT : Number.POSITIVE_INFINITY,
  );
  let bodyStart: HTMLDivElement | undefined;
  let scrollEl: HTMLDivElement | undefined;
  let gridEl: HTMLDivElement | undefined;
  // A note embed scrolls with the page; a page table scrolls inside itself.
  const vScroller = () => (embedded ? undefined : scrollEl);

  const fit = useScrollerFit({
    scroller: () => scrollEl,
    grid: () => gridEl,
    fitHeight: !embedded,
  });
  const cols = useColumns({
    store,
    view: () => props.view,
    scrollerWidth: fit.width,
  });
  const rows = createMemo(() =>
    applyView(
      store.state.rows,
      store.state.properties,
      store.effectiveConfig(props.view),
      store.state.today,
    ),
  );
  const selection = useRowSelection(() => rows());
  const limitedRows = createMemo(() => {
    const all = rows();
    const shown = all.slice(0, limit());
    const fresh = autoEditRowId();
    if (fresh && !shown.some((r) => r.id === fresh)) {
      const r = all.find((x) => x.id === fresh);
      if (r) shown.push(r);
    }
    return shown;
  });
  const insetOf = (attr: string) =>
    gridEl?.querySelector<HTMLElement>(`[${attr}] > *`)?.offsetHeight ?? 0;
  const windowed = useWindowedRows({
    count: () => limitedRows().length,
    body: () => bodyStart,
    scroller: vScroller,
    insets: () => ({
      top: insetOf("data-table-head"),
      bottom: insetOf("data-table-foot"),
    }),
  });
  // Keyed by the store's row objects, so rows that stay in the window keep
  // their DOM (and focus) when the window moves.
  const visible = createMemo(() => {
    const { start, end } = windowed.bounds();
    return limitedRows().slice(start, end);
  });
  const touch = useTouchTaps(openRow, () => gridEl);
  const keys = useGridKeys({
    viewId: () => props.view.id,
    rowCount: () => limitedRows().length,
    colCount: () => cols.columns().length,
    scroller: () => scrollEl,
    frozenWidth: cols.frozenWidth,
    reveal: windowed.reveal,
    onEscape: () => selection.count() && selection.clear(),
  });

  const addRow = async () => {
    const created = await store.addRow();
    if (!created) return;
    const index = Math.min(
      rows().findIndex((r) => r.id === created.id),
      limitedRows().length,
    );
    // A filter or search can hide the new row, and a window change remounts
    // rows and ends the edit. In both cases the name opens in the panel.
    // On touch, inline rename would raise the software keyboard over the table.
    if (
      index < 0 ||
      limitedRows().length > WINDOW_THRESHOLD ||
      touch.isTouch()
    ) {
      openRow(created.id);
      return;
    }
    windowed.reveal(index);
    setAutoEditRowId(created.id);
  };
  props.addRef?.(() => void addRow());

  return (
    <div style={{ position: "relative" }}>
      <Show when={selection.selectedIds().length > 0}>
        <BulkBar selected={selection.selectedIds()} onClear={selection.clear} />
      </Show>
      <div
        ref={scrollEl}
        class={embedded ? scroller : pageScroller}
        style={
          fit.maxHeight() === null
            ? undefined
            : { "max-height": `${fit.maxHeight()}px` }
        }
        onScroll={fit.measureEdge}
      >
        <div
          ref={gridEl}
          class={grid}
          style={cols.gridVars()}
          role="grid"
          aria-rowcount={rows().length + 1}
          data-grid={props.view.id}
          onKeyDown={keys.onKeyDown}
        >
          <TableHeaderRow
            viewId={props.view.id}
            cols={cols}
            selection={selection}
          />

          <div
            ref={bodyStart}
            style={{
              "grid-column": "1 / -1",
              height: `${windowed.bounds().start * ROW_HEIGHT}px`,
            }}
            aria-hidden="true"
          />

          <For each={visible()}>
            {(row, i) => {
              const index = () => windowed.bounds().start + i();
              return (
                <TableRow
                  row={row}
                  index={index()}
                  columns={cols.columns()}
                  selected={selection.isSelected(row.id)}
                  autoEdit={autoEditRowId() === row.id}
                  onToggle={(shift) => selection.toggle(row.id, shift)}
                  onAutoEditDone={() => setAutoEditRowId(null)}
                  onEditEnd={(c) => keys.onEditEnd(index(), c)}
                />
              );
            }}
          </For>

          <div
            style={{
              "grid-column": "1 / -1",
              height: `${Math.max(0, limitedRows().length - windowed.bounds().end) * ROW_HEIGHT}px`,
            }}
            aria-hidden="true"
          />

          <TableActions
            view={props.view}
            total={rows().length}
            shown={limitedRows().length}
            empty={rows().length === 0 && store.state.rows.length > 0}
            onShowAll={() => setLimit(Number.POSITIVE_INFINITY)}
            onAdd={() => void addRow()}
          />

          <TableFooterRow
            view={props.view}
            columns={cols.columns()}
            rows={rows()}
          />
        </div>
      </div>
      <div
        class={edgeFade}
        data-scroll-fade=""
        data-on={fit.moreRight() ? "" : undefined}
        aria-hidden="true"
      />
    </div>
  );
};
