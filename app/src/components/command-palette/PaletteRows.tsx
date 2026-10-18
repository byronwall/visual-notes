import { Show, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { Box } from "styled-system/jsx";
import type { PaletteIcon } from "./palette-commands";

export const paletteRowClass = css({
  display: "flex",
  alignItems: "center",
  gap: "2.5",
  w: "full",
  minH: "9",
  px: "3",
  py: "1.5",
  borderRadius: "l2",
  color: "fg.default",
  fontSize: "sm",
  textAlign: "left",
  textDecorationLine: "none",
  cursor: "pointer",
  bg: "transparent",
  transitionProperty: "background-color",
  transitionDuration: "120ms",
  _hover: { bg: "gray.a2", textDecorationLine: "none" },
  "&[data-selected]": { bg: "gray.a3" },
  "& > svg": { flexShrink: "0", color: "fg.muted" },
});

const labelClass = css({
  flex: "1",
  minW: "0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const trailingClass = css({
  fontSize: "xs",
  color: "fg.subtle",
  fontFamily: "mono",
  flexShrink: "0",
});

export const PaletteGroupLabel = (props: { children: JSX.Element }) => (
  <Box
    px="3"
    pt="2.5"
    pb="1"
    fontSize="xs"
    fontWeight="medium"
    color="fg.subtle"
    role="presentation"
  >
    {props.children}
  </Box>
);

// Selection follows real pointer movement (mousemove, not mouseenter) so
// results re-rendering under a resting cursor never steal the keyboard
// selection.
type RowBaseProps = {
  index: number;
  selected: boolean;
  label: JSX.Element;
  icon?: PaletteIcon;
  trailing?: string;
  onHover: () => void;
};

export const PaletteActionRow = (
  props: RowBaseProps & { onRun: () => void }
) => (
  <button
    type="button"
    class={paletteRowClass}
    data-command-index={props.index}
    data-selected={props.selected ? "" : undefined}
    role="option"
    aria-selected={props.selected}
    onMouseMove={() => props.onHover()}
    onClick={() => props.onRun()}
  >
    <Show when={props.icon} fallback={<PlusGlyph />}>
      {(icon) => {
        const Icon = icon();
        return <Icon size={16} strokeWidth={1.8} />;
      }}
    </Show>
    <span class={labelClass}>{props.label}</span>
    <Show when={props.trailing}>
      <kbd class={trailingClass}>{props.trailing}</kbd>
    </Show>
  </button>
);

export const PaletteNavRow = (
  props: RowBaseProps & {
    href: string;
    onActivate: (ev: MouseEvent) => void;
  }
) => (
  <a
    href={props.href}
    class={paletteRowClass}
    data-command-index={props.index}
    data-selected={props.selected ? "" : undefined}
    role="option"
    aria-selected={props.selected}
    onMouseMove={() => props.onHover()}
    onClick={(ev) => props.onActivate(ev)}
  >
    <Show when={props.icon}>
      {(icon) => {
        const Icon = icon();
        return <Icon size={16} strokeWidth={1.8} />;
      }}
    </Show>
    <span class={labelClass}>{props.label}</span>
    <span class={trailingClass}>{props.href}</span>
  </a>
);

const PlusGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 6v12M6 12h12"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  </svg>
);
