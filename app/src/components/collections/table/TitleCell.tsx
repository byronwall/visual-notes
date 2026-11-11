import { PencilIcon } from "lucide-solid";
import { Show, createEffect, createSignal, on } from "solid-js";
import { css } from "styled-system/css";
import type { CollectionRow } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import { noAutofill } from "~/components/ui/no-autofill";

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
  cursor: "default",
  "& [data-rename]": { opacity: "0" },
  "&:hover [data-rename], &:focus-within [data-rename]": { opacity: "1" },
  // Touch screens view and navigate; a tap opens the record, so renaming
  // happens in the peek panel and the pencil is hidden.
  "@media (hover: none)": { "& [data-rename]": { display: "none" } },
});
// The name is the row's link: it opens the record in the peek panel.
// A button so assistive tech and tests can reach it; out of the tab order,
// since the cell is the grid's tab stop and Enter there opens the record.
const title = css({
  display: "block",
  minW: "0",
  maxW: "full",
  textAlign: "left",
  fontSize: "sm",
  fontWeight: "medium",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: "color 140ms",
  "@media (hover: hover)": {
    _hover: { color: "fg.link" },
    "&[data-untitled]:hover": { color: "fg.link" },
  },
  "&[data-untitled]": { color: "fg.subtle", fontWeight: "normal" },
});
const renameBtn = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: "0",
  ml: "auto",
  w: "6",
  h: "6",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  transition: "opacity 140ms, color 140ms, background-color 140ms",
  _hover: { color: "fg.default", bg: "bg.muted" },
  _active: { bg: "bg.emphasized" },
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

/**
 * The row's note title. Clicking it or pressing Enter opens the record; F2,
 * typing, or the pencil button renames it in place.
 */
export const TitleCell = (props: {
  row: CollectionRow;
  autoEdit?: boolean;
  ref?: (el: HTMLDivElement) => void;
  onEditEnd?: (reason: "commit" | "cancel" | "tab" | "shift-tab") => void;
}) => {
  const { store, openRow } = useCollection();
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  let root$: HTMLDivElement | undefined;
  const untitled = () =>
    props.row.title === "Untitled" || !props.row.title.trim();

  const start = (initial?: string) => {
    setDraft(initial ?? (untitled() ? "" : props.row.title));
    setEditing(true);
  };
  // A new row opens straight into editing its name. The row can already be
  // on screen when the table marks it, so react to the flag turning on.
  createEffect(
    on(
      () => props.autoEdit,
      (auto) => {
        if (auto && !editing()) start();
      },
    ),
  );
  const finish = (
    reason: "commit" | "cancel" | "tab" | "shift-tab",
    refocus = true,
  ) => {
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
      onKeyDown={(e) => {
        if (editing() || e.target !== e.currentTarget) return;
        if (e.key === "F2") {
          e.preventDefault();
          start();
        } else if (e.key === "Enter" || (e.key === " " && e.shiftKey)) {
          e.preventDefault();
          openRow(props.row.id);
        } else if (
          e.key.length === 1 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.altKey
        ) {
          e.preventDefault();
          start(e.key);
        }
      }}
    >
      <button
        type="button"
        class={title}
        tabIndex={-1}
        data-title-link=""
        data-untitled={untitled() ? "" : undefined}
        // Keep focus where it is; the peek panel takes it next.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => !editing() && openRow(props.row.id)}
      >
        {untitled() ? "Untitled" : props.row.title}
      </button>
      <button
        type="button"
        class={renameBtn}
        data-rename=""
        tabIndex={-1}
        aria-label={`Rename ${untitled() ? "Untitled" : props.row.title}`}
        title="Rename (F2)"
        onClick={(e) => {
          e.stopPropagation();
          start();
        }}
      >
        <PencilIcon size={13} />
      </button>
      <Show when={editing()}>
        <input
          {...noAutofill}
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
