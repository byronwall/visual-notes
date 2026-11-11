import { Show } from "solid-js";
import { css } from "styled-system/css";
import { noAutofill } from "~/components/ui/no-autofill";
import { isCoarsePointer } from "./touch";

const narrow = "@container colpage (max-width: 35rem)";
const heading = css({
  minW: "0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "3xl",
  fontWeight: "bold",
  lineHeight: "1.15",
  px: "1",
  mx: "-1",
  borderRadius: "l2",
  cursor: "text",
  _hover: { bg: "bg.muted" },
  [narrow]: { fontSize: "2xl" },
});
const input = css({
  fontSize: "3xl",
  fontWeight: "bold",
  lineHeight: "1.15",
  px: "1",
  mx: "-1",
  borderRadius: "l2",
  bg: "bg.muted",
  outline: "none",
  flex: "1",
  minW: "0",
  w: "full",
  [narrow]: { fontSize: "2xl" },
});

/**
 * Collection name; click to rename. On touch a tap does not rename, so a
 * scroll or a stray tap never opens the keyboard; "…" has Rename instead.
 * Renders the same heading on server and client.
 */
export const CollectionTitle = (props: {
  name: string;
  icon?: string | null;
  onRename: (name: string) => void;
  editing: boolean;
  setEditing: (editing: boolean) => void;
}) => {
  const editing = () => props.editing;
  const setEditing = (value: boolean) => props.setEditing(value);
  const commit = (value: string) => {
    setEditing(false);
    if (value.trim() && value.trim() !== props.name)
      props.onRename(value.trim());
  };
  return (
    <Show
      when={editing()}
      fallback={
        <h1
          class={heading}
          tabIndex={0}
          title={props.name || undefined}
          onClick={() => !isCoarsePointer() && setEditing(true)}
          onKeyDown={(e) => e.key === "Enter" && setEditing(true)}
        >
          <Show when={props.icon}>
            <span style={{ "margin-right": "0.35em" }}>{props.icon}</span>
          </Show>
          {props.name || "Untitled collection"}
        </h1>
      }
    >
      <input
        {...noAutofill}
        class={input}
        value={props.name}
        aria-label="Collection name"
        ref={(el) => queueMicrotask(() => el.select())}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget.value);
          if (e.key === "Escape") setEditing(false);
        }}
      />
    </Show>
  );
};
