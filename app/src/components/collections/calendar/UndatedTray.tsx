import { CalendarPlusIcon } from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { css, cx } from "styled-system/css";
import type {
  CollectionProperty,
  CollectionRow,
} from "~/lib/collections/types";
import { draggable } from "../drag/startPointerDrag";

/** Rows rendered before "Show more"; every undated row stays reachable. */
const PAGE = 100;

const tray = css({
  display: "flex",
  flexDirection: "column",
  gap: "1",
  p: "2",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  bg: "bg.subtle",
  maxH: "min(70vh, 40rem)",
  overflowY: "auto",
  overscrollBehavior: "contain",
});
const item = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  minH: "8",
  pl: "2",
  borderRadius: "l1",
  bg: "bg.default",
  borderWidth: "1px",
  borderColor: "border",
  fontSize: "sm",
  cursor: "grab",
});
const itemTitle = css({
  flex: "1",
  minW: "0",
  py: "1",
  lineHeight: "1.35",
  wordBreak: "break-word",
});
const iconBtn = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: "0",
  boxSize: "8",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  transitionProperty: "color, background-color",
  transitionDuration: "140ms",
  _hover: { color: "fg.default", bg: "bg.muted" },
});
const hint = css({ fontSize: "xs", color: "fg.subtle", px: "0.5" });
const more = css({
  h: "8",
  borderRadius: "l1",
  fontSize: "sm",
  color: "fg.muted",
  cursor: "pointer",
  _hover: { bg: "bg.muted", color: "fg.default" },
});

/** Rows without a date: drag one onto a day, or set its date from the button. */
export const UndatedTray = (props: {
  rows: CollectionRow[];
  property: CollectionProperty;
  editable: boolean;
  onPointerDown: (row: CollectionRow, e: PointerEvent) => void;
  onOpen: (row: CollectionRow) => void;
  onDateMenu: (row: CollectionRow, el: HTMLElement) => void;
}) => {
  const [limit, setLimit] = createSignal(PAGE);
  return (
    <div class={tray} data-undated-tray>
      <span class={hint}>
        {props.editable
          ? "Drag a row onto a day, or set its date."
          : `${props.property.name} is set automatically.`}
      </span>
      <For
        each={props.rows.slice(0, limit())}
        fallback={<span class={hint}>Every row has a date.</span>}
      >
        {(row) => (
          <div
            class={cx(item, draggable)}
            onPointerDown={(e) => props.onPointerDown(row, e)}
            onClick={() => props.onOpen(row)}
          >
            <span class={itemTitle}>{row.title || "Untitled"}</span>
            <Show when={props.editable}>
              <button
                type="button"
                class={iconBtn}
                aria-label={`Set date of ${row.title || "Untitled"}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onDateMenu(row, e.currentTarget);
                }}
              >
                <CalendarPlusIcon size={15} />
              </button>
            </Show>
          </div>
        )}
      </For>
      <Show when={props.rows.length > limit()}>
        <button
          type="button"
          class={more}
          onClick={() => setLimit((n) => n + PAGE)}
        >
          Show {Math.min(PAGE, props.rows.length - limit())} more of{" "}
          {props.rows.length}
        </button>
      </Show>
    </div>
  );
};
