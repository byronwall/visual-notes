import { PlusIcon } from "lucide-solid";
import { For, Show, createMemo, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { applyView } from "~/lib/collections/query";
import type { CollectionView } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import { EmptyRows } from "../table/EmptyRows";
import { useRowSelection } from "../table/useRowSelection";
import { useWindowedRows } from "../table/useWindowedRows";
import { ListHeader } from "./ListHeader";
import { ListRow } from "./ListRow";
import { listFields, listRowHeight } from "./listFields";

const EMBED_ROW_LIMIT = 25;

const root = css({ position: "relative", minW: "0" });
const list = css({ borderTopWidth: "1px", borderColor: "border" });
const actionRow = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5",
  w: "full",
  h: "11",
  color: "fg.muted",
  fontSize: "sm",
  cursor: "pointer",
  borderBottomWidth: "1px",
  borderColor: "border",
  _hover: { bg: "bg.subtle", color: "fg.default" },
});
const emptyAll = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "2",
  py: "8",
  color: "fg.muted",
  fontSize: "sm",
});

/**
 * A table view on a narrow screen: one read-only record per row, sized for
 * reading and tapping. It scrolls with the page, so phones keep their native
 * momentum scrolling, and windows long lists by a fixed row height.
 */
export const CollectionList = (props: {
  view: CollectionView;
  /** Receives the action behind the toolbar's New button. */
  addRef?: (add: () => void) => void;
}) => {
  const { store, embedded, openRow } = useCollection();
  const [limit, setLimit] = createSignal(
    embedded ? EMBED_ROW_LIMIT : Number.POSITIVE_INFINITY,
  );
  const [selecting, setSelecting] = createSignal(false);
  let bodyStart: HTMLDivElement | undefined;

  const rows = createMemo(() =>
    applyView(
      store.state.rows,
      store.state.properties,
      store.effectiveConfig(props.view),
      store.state.today,
    ),
  );
  const shown = createMemo(() => rows().slice(0, limit()));
  const fields = createMemo(() =>
    listFields(store.state.properties, props.view.config),
  );
  const rowHeight = () => listRowHeight(fields().length);
  const selection = useRowSelection(() => rows());
  const windowed = useWindowedRows({
    count: () => shown().length,
    body: () => bodyStart,
    // The page (or the note around an embed) scrolls, not the list.
    scroller: () => undefined,
    insets: () => ({ top: 0, bottom: 0 }),
    rowHeight,
  });
  const visible = createMemo(() => {
    const { start, end } = windowed.bounds();
    return shown().slice(start, end);
  });

  // A new record opens in the panel; nothing is focused there on touch, so
  // the keyboard stays down until the user taps a field.
  const addRow = async () => {
    const created = await store.addRow();
    if (created) openRow(created.id);
  };
  props.addRef?.(() => void addRow());

  const endSelecting = () => {
    selection.clear();
    setSelecting(false);
  };

  return (
    <div class={root}>
      <Show when={store.state.rows.length > 0}>
        <ListHeader
          total={store.state.rows.length}
          matched={rows().length}
          sticky={!embedded}
          selecting={selecting()}
          selection={selection}
          onSelect={() => setSelecting(true)}
          onDone={endSelecting}
        />
      </Show>
      <div class={list} role="list" aria-label={props.view.name}>
        <div
          ref={bodyStart}
          style={{ height: `${windowed.bounds().start * rowHeight()}px` }}
          aria-hidden="true"
        />
        <For each={visible()}>
          {(row) => (
            <ListRow
              row={row}
              fields={fields()}
              height={rowHeight()}
              selecting={selecting()}
              selected={selection.isSelected(row.id)}
              onOpen={() => openRow(row.id)}
              onToggle={() => selection.toggle(row.id, false)}
            />
          )}
        </For>
        <div
          style={{
            height: `${Math.max(0, shown().length - windowed.bounds().end) * rowHeight()}px`,
          }}
          aria-hidden="true"
        />
      </div>
      <Show when={shown().length < rows().length}>
        <button
          type="button"
          class={actionRow}
          onClick={() => setLimit(Number.POSITIVE_INFINITY)}
        >
          Show all {rows().length} rows
        </button>
      </Show>
      <Show when={rows().length === 0 && store.state.rows.length > 0}>
        <EmptyRows view={props.view} />
      </Show>
      <Show when={store.state.rows.length === 0}>
        <div class={emptyAll}>
          No rows yet
          <button
            type="button"
            class={actionRow}
            onClick={() => void addRow()}
          >
            <PlusIcon size={14} /> New
          </button>
        </div>
      </Show>
    </div>
  );
};
