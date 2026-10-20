import { type JSX, Show, splitProps } from "solid-js";
import { css, cx } from "styled-system/css";

export const menuPanel = css({ display: "flex", flexDirection: "column", py: "1", minW: "52", fontSize: "sm" });
export const menuSection = css({ px: "2.5", pt: "2", pb: "1", fontSize: "xs", color: "fg.subtle", fontWeight: "medium" });
export const menuSeparator = css({ h: "1px", bg: "border", my: "1" });
const itemClass = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  w: "full",
  px: "2.5",
  h: "8",
  textAlign: "left",
  cursor: "pointer",
  color: "fg.default",
  _hover: { bg: "bg.muted" },
  _focusVisible: { bg: "bg.muted", outline: "none" },
  "&[data-danger]": { color: "fg.error" },
  "&[data-selected]": { fontWeight: "medium" },
  _disabled: { opacity: "0.5", cursor: "default" },
});
const trailing = css({ ml: "auto", color: "fg.subtle", fontSize: "xs", display: "inline-flex", alignItems: "center" });

export const MenuItem = (
  props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: JSX.Element;
    trailing?: JSX.Element;
    danger?: boolean;
    selected?: boolean;
  },
) => {
  const [local, rest] = splitProps(props, ["icon", "trailing", "danger", "selected", "children", "class"]);
  return (
    <button
      type="button"
      class={cx(itemClass, local.class)}
      data-danger={local.danger ? "" : undefined}
      data-selected={local.selected ? "" : undefined}
      {...rest}
    >
      <Show when={local.icon}>
        <span style={{ display: "inline-flex", color: "var(--colors-fg-muted)" }}>{local.icon}</span>
      </Show>
      <span style={{ flex: "1", "min-width": "0", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
        {local.children}
      </span>
      <Show when={local.trailing}>
        <span class={trailing}>{local.trailing}</span>
      </Show>
    </button>
  );
};

export const menuInput = css({
  mx: "2",
  my: "1",
  h: "8",
  px: "2",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  bg: "bg.default",
  fontSize: "sm",
  outline: "none",
  _focus: { borderColor: "border.accent" },
});
