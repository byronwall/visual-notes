import { Show } from "solid-js";
import { css } from "styled-system/css";

const button = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "0.5",
  w: "full",
  px: "2.5",
  py: "2",
  textAlign: "left",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "md",
  bg: "bg.default",
  color: "fg.default",
  cursor: "pointer",
  transition: "background-color 140ms, border-color 140ms",
  _hover: { bg: "bg.hover" },
  _disabled: { opacity: 0.5, cursor: "default", _hover: { bg: "bg.default" } },
  "&[data-primary]": {
    bg: "blue.9",
    borderColor: "blue.9",
    color: "white",
    _hover: { bg: "blue.10" },
  },
});
const name = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  w: "full",
  fontSize: "sm",
  fontWeight: "semibold",
});
const what = css({
  fontSize: "xs",
  lineHeight: "1.35",
  color: "fg.muted",
  "[data-primary] &": { color: "white", opacity: 0.85 },
});
const kbd = css({
  ml: "auto",
  fontSize: "xs",
  fontWeight: "medium",
  opacity: 0.7,
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
      data-primary={props.primary || undefined}
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
