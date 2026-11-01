import type { JSX } from "solid-js";
import { css } from "styled-system/css";

const baseClass = css({
  w: "full",
  borderRadius: "l2",
  color: "fg.default",
  cursor: "pointer",
  transitionProperty: "background-color",
  transitionDuration: "fast",
  bg: "gray.a2",
  _active: { bg: "gray.a5" },
  "&[aria-pressed=true]": {
    bg: "bg.selected",
    color: "fg.selected",
    fontWeight: "medium",
  },
  _disabled: { color: "fg.subtle", opacity: 0.5, cursor: "default" },
  _focusVisible: {
    outline: "2px solid token(colors.border.focus)",
    outlineOffset: "-2px",
  },
});

const choiceClass = css({ h: "11", fontSize: "sm", whiteSpace: "nowrap" });

const actionClass = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5",
  h: "14",
  fontSize: "xs",
  lineHeight: "1rem",
  "&[data-danger=true]": { color: "red.11" },
});

export const TaskSheetChoice = (props: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    class={`${baseClass} ${choiceClass}`}
    aria-pressed={props.pressed}
    onClick={() => props.onClick()}
  >
    {props.label}
  </button>
);

export const TaskSheetAction = (props: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: JSX.Element;
}) => (
  <button
    type="button"
    class={`${baseClass} ${actionClass}`}
    aria-pressed={props.pressed ?? undefined}
    disabled={props.disabled}
    data-danger={props.danger ? "true" : undefined}
    onClick={() => props.onClick()}
  >
    {props.children}
    {props.label}
  </button>
);
