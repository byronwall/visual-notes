import { PanelRightOpenIcon } from "lucide-solid";
import { Show, createSignal, untrack } from "solid-js";
import { css } from "styled-system/css";
import type { CollectionRow } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";

const root = css({
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: "1",
  minW: "0",
  w: "full",
  minH: "8",
  px: "2",
  outline: "none",
  cursor: "text",
  "& [data-open]": { opacity: "0" },
  "&:hover [data-open], &:focus-within [data-open]": { opacity: "1" },
});
const title = css({
  flex: "1",
  minW: "0",
  fontSize: "sm",
  fontWeight: "medium",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  "&[data-untitled]": { color: "fg.subtle", fontWeight: "normal" },
});
const openBtn = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  flexShrink: "0",
  h: "6",
  px: "1.5",
  borderRadius: "l1",
  borderWidth: "1px",
  borderColor: "border",
  bg: "bg.default",
  color: "fg.muted",
  fontSize: "xs",
  cursor: "pointer",
  transition: "opacity 120ms",
  _hover: { color: "fg.default", bg: "bg.muted" },
});
const input = css({
  position: "absolute",
  inset: "0",
  px: "2",
  fontSize: "sm",
  fontWeight: "medium",
  bg: "bg.default",
  outline: "none",
  boxShadow: "inset 0 0 0 2px token(colors.border.accent)",
  borderRadius: "l1",
  zIndex: "1",
});

/** The row's note title, editable in place, with an "Open" button for the peek panel. */
export const TitleCell = (props: {
  row: CollectionRow;
  autoEdit?: boolean;
  ref?: (el: HTMLDivElement) => void;
  onEditEnd?: (reason: "commit" | "cancel" | "tab" | "shift-tab") => void;
}) => {
  const { store, openRow } = useCollection();
  // Initial values only: a new row opens straight into editing its name.
  const [editing, setEditing] = createSignal(untrack(() => Boolean(props.autoEdit)));
  const [draft, setDraft] = createSignal(untrack(() => (props.row.title === "Untitled" && props.autoEdit ? "" : props.row.title)));
  let root$: HTMLDivElement | undefined;
  const untitled = () => props.row.title === "Untitled" || !props.row.title.trim();

  const start = (initial?: string) => {
    setDraft(initial ?? (untitled() ? "" : props.row.title));
    setEditing(true);
  };
  const finish = (reason: "commit" | "cancel" | "tab" | "shift-tab", refocus = true) => {
    if (!editing()) return;
    setEditing(false);
    if (reason !== "cancel") void store.setTitle(props.row.id, draft());
    if (refocus) queueMicrotask(() => root$?.focus());
    props.onEditEnd?.(reason);
  };

  return (
    <div
      ref={(el) => {
        root$ = el;
        props.ref?.(el);
      }}
      class={root}
      tabIndex={0}
      data-cell=""
      data-property-id="title"
      aria-label="Name"
      onClick={() => !editing() && start()}
      onKeyDown={(e) => {
        if (editing()) return;
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          start();
        } else if (e.key === " " && e.shiftKey) {
          e.preventDefault();
          openRow(props.row.id);
        } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          start(e.key);
        }
      }}
    >
      <span class={title} data-untitled={untitled() ? "" : undefined}>
        {untitled() ? "Untitled" : props.row.title}
      </span>
      <button
        type="button"
        class={openBtn}
        data-open=""
        aria-label={`Open ${props.row.title}`}
        onClick={(e) => {
          e.stopPropagation();
          openRow(props.row.id);
        }}
      >
        <PanelRightOpenIcon size={12} />
        Open
      </button>
      <Show when={editing()}>
        <input
          class={input}
          value={draft()}
          placeholder="Untitled"
          aria-label="Edit name"
          ref={(el) => queueMicrotask(() => el.focus())}
          onClick={(e) => e.stopPropagation()}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onBlur={() => finish("commit", false)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              finish("commit");
            } else if (e.key === "Escape") {
              e.preventDefault();
              finish("cancel");
            } else if (e.key === "Tab") {
              e.preventDefault();
              finish(e.shiftKey ? "shift-tab" : "tab");
            }
          }}
        />
      </Show>
    </div>
  );
};
