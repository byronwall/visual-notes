import { Show } from "solid-js";
import { css } from "styled-system/css";

// A row in a list of actions, not a boxed card: dense, borderless, with a
// hover fill. The primary action's name is blue and carries its shortcut.
const button = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "0.5",
  w: "calc(100% + token(spacing.4))",
  mx: "-2",
  px: "2",
  py: "1.5",
  textAlign: "left",
  border: "none",
  borderRadius: "md",
  bg: "transparent",
  color: "fg.default",
  cursor: "pointer",
  transition: "background-color 140ms",
  _hover: { bg: "bg.hover" },
  _active: { bg: "bg.active" },
  _disabled: {
    opacity: 0.5,
    cursor: "default",
    _hover: { bg: "transparent" },
  },
});
const name = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  w: "full",
  fontSize: "sm",
  fontWeight: "semibold",
  "[data-primary=true] &": { color: "blue.11" },
});
const what = css({
  fontSize: "xs",
  lineHeight: "1.4",
  color: "fg.muted",
});
const kbd = css({
  ml: "auto",
  px: "1",
  borderRadius: "sm",
  bg: "bg.subtle",
  fontSize: "xs",
  fontWeight: "medium",
  color: "fg.muted",
});

/** An agent action: a short name plus one line on what it will do to the map. */
export function ActionButton(props: {
  label: string;
  what: string;
  primary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      class={button}
      data-primary={String(!!props.primary)}
      disabled={props.disabled}
      onClick={() => props.onClick()}
    >
      <span class={name}>
        {props.busy ? "Thinking…" : props.label}
        <Show when={props.shortcut}>
          <kbd class={kbd}>{props.shortcut}</kbd>
        </Show>
      </span>
      <span class={what}>{props.what}</span>
    </button>
  );
}
