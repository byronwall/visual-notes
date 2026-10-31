import { PlusIcon } from "lucide-solid";
import {
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { css } from "styled-system/css";
import {
  applyView,
  orderedProperties,
  TITLE_PROPERTY,
} from "~/lib/collections/query";
import type {
  Aggregation,
  CollectionProperty,
  CollectionView,
} from "~/lib/collections/types";
import { TITLE_PROPERTY_ID } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import { AddPropertyMenu } from "../menu/AddPropertyMenu";
import { ValueCell } from "../values/ValueCell";
import { BulkBar } from "./BulkBar";
import { FooterCell } from "./FooterCell";
import { TableHeaderCell } from "./TableHeaderCell";
import { TitleCell } from "./TitleCell";
import {
  ROW_HEIGHT,
  WINDOW_THRESHOLD,
  useWindowedRows,
} from "./useWindowedRows";

const DEFAULT_WIDTH = 180;
const TITLE_WIDTH = 280;
const SELECT_COLUMN = 32;
const ADD_COLUMN = 44;
const EMBED_ROW_LIMIT = 25;

const scroller = css({
  overflowX: "auto",
  overflowY: "visible",
  borderTopWidth: "1px",
  borderColor: "border",
});
// On a collection page the table scrolls inside itself so the header and
// footer can stick; horizontal overflow would otherwise defeat vertical sticky.
const pageScroller = css({
  overflow: "auto",
  maxH: "calc(100dvh - 12rem)",
  borderTopWidth: "1px",
  borderColor: "border",
  overscrollBehavior: "contain",
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
});
const headerRow = css({
  display: "contents",
  "& > *": {
    position: "sticky",
    top: "0",
    zIndex: "2",
    bg: "bg.default",
    borderBottomWidth: "1px",
    borderColor: "border",
  },
});
const row = css({
  display: "contents",
  "& > *": {
    borderBottomWidth: "1px",
    borderColor: "border",
    minW: "0",
    bg: "bg.default",
    height: `${ROW_HEIGHT}px`,
  },
  "&:hover > *": { bg: "bg.subtle" },
  "&[data-selected] > *, &[data-selected]:hover > *": { bg: "bg.selected" },
  "& [data-select-box]": { opacity: "0" },
  "&:hover [data-select-box], &[data-selected] [data-select-box]": {
    opacity: "1",
  },
});
const bodyCell = css({
  borderRightWidth: "1px",
  borderColor: "border",
  display: "flex",
  alignItems: "stretch",
  minW: "0",
  overflow: "hidden",
  "&:focus-within": {
    boxShadow: "inset 0 0 0 2px token(colors.border.accent)",
  },
});
// The checkbox and name columns stay put while the table scrolls sideways.
const stickySelect = css({ position: "sticky", left: "0", zIndex: "1" });
const stickyTitle = css({
  position: "sticky",
  zIndex: "1",
  boxShadow: "1px 0 0 token(colors.border)",
});
const selectCell = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});
const selectBox = css({
  cursor: "pointer",
  accentColor: "currentColor",
  transition: "opacity 100ms",
});
const footerRow = css({
  display: "contents",
  "& > *": {
    position: "sticky",
    bottom: "0",
    zIndex: "2",
    borderBottomWidth: "1px",
    borderColor: "border",
    bg: "bg.default",
    minW: "0",
  },
});
const newRowBtn = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  h: "9",
  px: "2",
  color: "fg.subtle",
  cursor: "pointer",
  w: "full",
  textAlign: "left",
  borderBottomWidth: "1px",
  borderColor: "border",
  _hover: { bg: "bg.subtle", color: "fg.default" },
});
const empty = css({
  px: "3",
  py: "8",
  color: "fg.muted",
  fontSize: "sm",
  textAlign: "center",
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
  const [selected, setSelected] = createSignal<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = createSignal<string | null>(null);
  const [liveWidths, setLiveWidths] = createSignal<Record<string, number>>({});
  const [dragId, setDragId] = createSignal<string | null>(null);
  const [drop, setDrop] = createSignal<{
    id: string;
    side: "before" | "after";
  } | null>(null);
  const [moreRight, setMoreRight] = createSignal(false);
  let bodyStart: HTMLDivElement | undefined;
  let scrollEl: HTMLDivElement | undefined;
  let gridEl: HTMLDivElement | undefined;

  const measureRightEdge = () => {
    if (!scrollEl) return;
    const { scrollWidth, clientWidth, scrollLeft } = scrollEl;
    setMoreRight(scrollWidth - clientWidth - scrollLeft > 1);
  };
  onMount(() => {
    const observer = new ResizeObserver(measureRightEdge);
    observer.observe(scrollEl!);
    observer.observe(gridEl!);
    onCleanup(() => observer.disconnect());
  });

  const config = () => store.effectiveConfig(props.view);
  const columns = createMemo<CollectionProperty[]>(() => [
    TITLE_PROPERTY,
    ...orderedProperties(store.state.properties, props.view.config),
  ]);
  const rows = createMemo(() =>
    applyView(
      store.state.rows,
      store.state.properties,
      config(),
      store.state.today,
    ),
  );
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
  const windowed = useWindowedRows(
    () => limitedRows().length,
    () => bodyStart,
  );
  const visible = createMemo(() => {
    const { start, end } = windowed.bounds();
    return limitedRows()
      .slice(start, end)
      .map((r, i) => ({ row: r, index: start + i }));
  });

  const widthOf = (id: string) =>
    liveWidths()[id] ??
    props.view.config.columnWidths?.[id] ??
    (id === TITLE_PROPERTY_ID ? TITLE_WIDTH : DEFAULT_WIDTH);
  const template = () =>
    `${SELECT_COLUMN}px ${columns()
      .map((c) => `${widthOf(c.id)}px`)
      .join(" ")} ${ADD_COLUMN}px`;
  const aggregationOf = (id: string): Aggregation =>
    props.view.config.aggregations?.[id] ??
    (id === TITLE_PROPERTY_ID ? "count" : "none");

  const resize = (id: string, width: number, done: boolean) => {
    setLiveWidths((w) => ({ ...w, [id]: width }));
    if (done) {
      store.patchViewConfig(props.view.id, {
        columnWidths: {
          ...(props.view.config.columnWidths ?? {}),
          [id]: width,
        },
      });
      setLiveWidths((w) => {
        const next = { ...w };
        delete next[id];
        return next;
      });
    }
  };

  const finishDrag = () => {
    const from = dragId();
    const target = drop();
    setDragId(null);
    setDrop(null);
    if (
      !from ||
      !target ||
      from === target.id ||
      target.id === TITLE_PROPERTY_ID
    )
      return;
    const ids = orderedProperties(store.state.properties, props.view.config, {
      includeHidden: true,
    })
      .map((p) => p.id)
      .filter((id) => id !== from);
    const at = ids.indexOf(target.id) + (target.side === "after" ? 1 : 0);
    ids.splice(at, 0, from);
    store.patchViewConfig(props.view.id, { propertyOrder: ids });
  };

  const toggleRow = (id: string, shift: boolean) => {
    const next = new Set(selected());
    const anchor = lastClicked();
    if (shift && anchor) {
      const ids = rows().map((r) => r.id);
      const [a, b] = [ids.indexOf(anchor), ids.indexOf(id)].sort(
        (x, y) => x - y,
      );
      for (const rid of ids.slice(a, b + 1)) next.add(rid);
    } else if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setLastClicked(id);
  };
  const allSelected = () =>
    rows().length > 0 && rows().every((r) => selected().has(r.id));
  const selectedIds = () =>
    rows()
      .filter((r) => selected().has(r.id))
      .map((r) => r.id);

  const focusCell = (rowIndex: number, colIndex: number) => {
    const n = limitedRows().length;
    if (n === 0) return;
    const r = Math.max(0, Math.min(n - 1, rowIndex));
    const c = Math.max(0, Math.min(columns().length - 1, colIndex));
    windowed.reveal(r);
    queueMicrotask(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-grid="${props.view.id}"] [data-row-index="${r}"][data-col-index="${c}"] [data-cell]`,
      );
      target?.focus();
    });
  };

  const onGridKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (!target.matches("[data-cell]")) return;
    const holder = target.closest<HTMLElement>("[data-row-index]");
    if (!holder) return;
    const r = Number(holder.dataset.rowIndex);
    const c = Number(holder.dataset.colIndex);
    const moves: Record<string, [number, number]> = {
      ArrowUp: [r - 1, c],
      ArrowDown: [r + 1, c],
      ArrowLeft: [r, c - 1],
      ArrowRight: [r, c + 1],
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      focusCell(move[0], move[1]);
    } else if (e.key === "Tab") {
      e.preventDefault();
      focusCell(r, c + (e.shiftKey ? -1 : 1));
    } else if (e.key === "Escape" && selected().size) {
      setSelected(new Set<string>());
    }
  };

  const onEditEnd =
    (rowIndex: number, colIndex: number) =>
    (reason: "commit" | "cancel" | "tab" | "shift-tab") => {
      if (reason === "tab") focusCell(rowIndex, colIndex + 1);
      else if (reason === "shift-tab") focusCell(rowIndex, colIndex - 1);
    };

  const addRow = async () => {
    const created = await store.addRow();
    if (!created) return;
    const index = Math.min(
      rows().findIndex((r) => r.id === created.id),
      limitedRows().length,
    );
    // A filter or search can hide the new row, and a window change remounts
    // rows and ends the edit. In both cases the name opens in the panel.
    if (index < 0 || limitedRows().length > WINDOW_THRESHOLD) {
      openRow(created.id);
      return;
    }
    // The page table scrolls inside itself; a note embed scrolls with the page.
    if (!embedded && scrollEl)
      scrollEl.scrollTop = index * ROW_HEIGHT - scrollEl.clientHeight / 2;
    windowed.reveal(index);
    setAutoEditRowId(created.id);
  };
  props.addRef?.(() => void addRow());

  const stickyTitleStyle = { left: `${SELECT_COLUMN}px` };

  return (
    <div style={{ position: "relative" }}>
      <Show when={selectedIds().length > 0}>
        <BulkBar
          selected={selectedIds()}
          onClear={() => setSelected(new Set<string>())}
        />
      </Show>
      <div
        ref={scrollEl}
        class={embedded ? scroller : pageScroller}
        onScroll={measureRightEdge}
      >
        <div
          ref={gridEl}
          class={grid}
          style={{ "grid-template-columns": template() }}
          role="grid"
          aria-rowcount={rows().length + 1}
          data-grid={props.view.id}
          onKeyDown={onGridKeyDown}
        >
          <div class={headerRow} role="row">
            <div
              class={`${selectCell} ${stickySelect}`}
              style={{ "z-index": 3 }}
            >
              <input
                type="checkbox"
                class={selectBox}
                style={{ opacity: selected().size ? 1 : 0.35 }}
                aria-label="Select all rows"
                checked={allSelected()}
                onChange={() =>
                  setSelected(
                    allSelected()
                      ? new Set<string>()
                      : new Set(rows().map((r) => r.id)),
                  )
                }
              />
            </div>
            <For each={columns()}>
              {(property) => (
                <div
                  class={
                    property.id === TITLE_PROPERTY_ID ? stickyTitle : undefined
                  }
                  style={
                    property.id === TITLE_PROPERTY_ID
                      ? { ...stickyTitleStyle, "z-index": 3 }
                      : undefined
                  }
                >
                  <TableHeaderCell
                    property={property}
                    viewId={props.view.id}
                    width={widthOf(property.id)}
                    dropSide={
                      dragId() && drop()?.id === property.id
                        ? drop()!.side
                        : null
                    }
                    onResize={(w, done) => resize(property.id, w, done)}
                    onDragStart={setDragId}
                    onDragOver={(id, side) => setDrop({ id, side })}
                    onDrop={finishDrag}
                    onDragEnd={() => {
                      setDragId(null);
                      setDrop(null);
                    }}
                  />
                </div>
              )}
            </For>
            <div role="columnheader">
              <AddPropertyMenu />
            </div>
          </div>

          <div
            ref={bodyStart}
            style={{
              "grid-column": "1 / -1",
              height: `${windowed.bounds().start * ROW_HEIGHT}px`,
            }}
            aria-hidden="true"
          />

          <For each={visible()}>
            {(entry) => (
              <div
                class={row}
                role="row"
                data-row-id={entry.row.id}
                data-selected={selected().has(entry.row.id) ? "" : undefined}
              >
                <div class={`${selectCell} ${stickySelect}`}>
                  <input
                    type="checkbox"
                    class={selectBox}
                    data-select-box
                    aria-label={`Select ${entry.row.title}`}
                    checked={selected().has(entry.row.id)}
                    onClick={(e) => toggleRow(entry.row.id, e.shiftKey)}
                  />
                </div>
                <For each={columns()}>
                  {(property, colIndex) => (
                    <div
                      class={`${bodyCell} ${property.id === TITLE_PROPERTY_ID ? stickyTitle : ""}`}
                      style={
                        property.id === TITLE_PROPERTY_ID
                          ? stickyTitleStyle
                          : undefined
                      }
                      role="gridcell"
                      data-row-index={entry.index}
                      data-col-index={colIndex()}
                    >
                      <Show
                        when={property.id !== TITLE_PROPERTY_ID}
                        fallback={
                          <TitleCell
                            row={entry.row}
                            autoEdit={autoEditRowId() === entry.row.id}
                            onEditEnd={(reason) => {
                              if (autoEditRowId() === entry.row.id)
                                setAutoEditRowId(null);
                              onEditEnd(entry.index, colIndex())(reason);
                            }}
                          />
                        }
                      >
                        <ValueCell
                          property={property}
                          row={entry.row}
                          store={store}
                          onEditEnd={onEditEnd(entry.index, colIndex())}
                        />
                      </Show>
                    </div>
                  )}
                </For>
                <div />
              </div>
            )}
          </For>

          <div
            style={{
              "grid-column": "1 / -1",
              height: `${Math.max(0, limitedRows().length - windowed.bounds().end) * ROW_HEIGHT}px`,
            }}
            aria-hidden="true"
          />

          <div style={{ "grid-column": "1 / -1" }}>
            <Show when={limitedRows().length < rows().length}>
              <button
                type="button"
                class={newRowBtn}
                onClick={() => setLimit(Number.POSITIVE_INFINITY)}
              >
                Show all {rows().length} rows
              </button>
            </Show>
            <Show when={rows().length === 0 && store.state.rows.length > 0}>
              <div class={empty}>No rows match this view.</div>
            </Show>
            <button
              type="button"
              class={newRowBtn}
              onClick={() => void addRow()}
            >
              <PlusIcon size={14} />
              New
            </button>
          </div>

          <div class={footerRow} role="row">
            <div class={stickySelect} />
            <For each={columns()}>
              {(property) => (
                <div
                  class={
                    property.id === TITLE_PROPERTY_ID ? stickyTitle : undefined
                  }
                  style={
                    property.id === TITLE_PROPERTY_ID
                      ? stickyTitleStyle
                      : undefined
                  }
                >
                  <FooterCell
                    property={property}
                    rows={rows()}
                    aggregation={aggregationOf(property.id)}
                    onChange={(aggregation) =>
                      store.patchViewConfig(props.view.id, {
                        aggregations: {
                          ...(props.view.config.aggregations ?? {}),
                          [property.id]: aggregation,
                        },
                      })
                    }
                  />
                </div>
              )}
            </For>
            <div />
          </div>
        </div>
      </div>
      <div
        class={edgeFade}
        data-scroll-fade=""
        data-on={moreRight() ? "" : undefined}
        aria-hidden="true"
      />
    </div>
  );
};
