import { Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { noAutofill } from "~/components/ui/no-autofill";

const heading = css({
  fontSize: "3xl",
  fontWeight: "bold",
  lineHeight: "1.15",
  px: "1",
  mx: "-1",
  borderRadius: "l2",
  cursor: "text",
  _hover: { bg: "bg.muted" },
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
  minW: "16rem",
});

/** Collection name; click to rename. Renders the same heading on server and client. */
export const CollectionTitle = (props: {
  name: string;
  icon?: string | null;
  onRename: (name: string) => void;
}) => {
  const [editing, setEditing] = createSignal(false);
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
          onClick={() => setEditing(true)}
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
