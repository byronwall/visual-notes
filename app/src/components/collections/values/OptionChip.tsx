import { type JSX, Show } from "solid-js";
import { css, cx } from "styled-system/css";
import { optionColorVars } from "~/lib/collections/colors";
import type { SelectOption } from "~/lib/collections/types";

const chip = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  maxW: "full",
  minW: "0",
  px: "1.5",
  h: "5",
  borderRadius: "l1",
  fontSize: "xs",
  fontWeight: "medium",
  lineHeight: "1",
  whiteSpace: "nowrap",
  bg: "var(--chip-bg)",
  color: "var(--chip-fg)",
  _dark: { bg: "var(--chip-bg-dark)", color: "var(--chip-fg-dark)" },
});

const dot = css({
  boxSize: "1.5",
  borderRadius: "full",
  flexShrink: "0",
  bg: "var(--chip-ink)",
});

const label = css({ overflow: "hidden", textOverflow: "ellipsis" });

export const OptionChip = (props: {
  option: Pick<SelectOption, "name" | "color">;
  /** Status options show a leading dot, like a status pill. */
  showDot?: boolean;
  class?: string;
  trailing?: JSX.Element;
}) => (
  <span
    class={cx(chip, props.class)}
    style={optionColorVars(props.option.color)}
    title={props.option.name}
  >
    <Show when={props.showDot}>
      <span class={dot} />
    </Show>
    <span class={label}>{props.option.name}</span>
    {props.trailing}
  </span>
);
