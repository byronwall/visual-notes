import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import * as Popover from "~/components/ui/popover";
import type { CollectionProperty } from "~/lib/collections/types";
import { isDateValue, readValue } from "~/lib/collections/values";
import { useCollection } from "../CollectionContext";
import { fitContent } from "../popover-styles";
import { DateEditor } from "../values/DateEditor";

/** The row whose date is being changed, and the element the menu points at. */
export type DateMenuTarget = { rowId: string; el: HTMLElement };

// One menu serves every event, agenda row and undated row; this fixed box
// sits over the clicked element so the popover can anchor to it.
const anchor = css({ position: "fixed", pointerEvents: "none" });
const head = css({
  px: "3",
  pt: "3",
  fontSize: "sm",
  fontWeight: "medium",
  maxW: "72",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

/** "Change date" without dragging: a date editor for one calendar row. */
export const DateMenu = (props: {
  target: DateMenuTarget | null;
  property: CollectionProperty;
  onClose: () => void;
}) => {
  const { store } = useCollection();
  const [rect, setRect] = createSignal({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  createEffect(() => {
    const target = props.target;
    if (!target) return;
    const update = () => {
      // The element is replaced once the row moves to its new day.
      if (target.el.isConnected) setRect(target.el.getBoundingClientRect());
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    onCleanup(() => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    });
  });

  const row = () =>
    store.state.rows.find((r) => r.id === props.target?.rowId) ?? null;
  const value = () => {
    const r = row();
    const v = r ? readValue(r, props.property) : null;
    return isDateValue(v) ? v : null;
  };

  return (
    <Popover.Root
      open={Boolean(props.target)}
      onOpenChange={(d) => !d.open && props.onClose()}
      positioning={{ placement: "bottom-start" }}
    >
      <Popover.Anchor
        class={anchor}
        style={{
          left: `${rect().left}px`,
          top: `${rect().top}px`,
          width: `${rect().width}px`,
          height: `${rect().height}px`,
        }}
      />
      <Portal>
        <Popover.Positioner>
          <Popover.Content class={fitContent}>
            {/* Keyed so the editor starts fresh for each row. */}
            <Show when={props.target?.rowId} keyed>
              {(id) => (
                <>
                  <div class={head}>{row()?.title || "Untitled"}</div>
                  <DateEditor
                    value={value()}
                    includeTime={Boolean(props.property.config.includeTime)}
                    onChange={(next) =>
                      void store.setValues([id], { [props.property.id]: next })
                    }
                    onDone={props.onClose}
                  />
                </>
              )}
            </Show>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
