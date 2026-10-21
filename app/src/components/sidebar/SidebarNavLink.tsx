import type { JSX } from "solid-js";
import { Show, splitProps } from "solid-js";
import { css } from "styled-system/css";
import { Box } from "styled-system/jsx";
import { Tooltip } from "~/components/ui/tooltip";
import type { SidebarNavIcon } from "./nav-items";

/**
 * Shared row style for every sidebar entry (links and action buttons) so
 * hover, active, focus, and the collapsed icon rail stay identical.
 */
export const sidebarRowClass = css({
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: "2.5",
  w: "full",
  h: "8",
  px: "2.5",
  borderRadius: "l2",
  color: "fg.muted",
  fontSize: "sm",
  fontWeight: "normal",
  lineHeight: "1",
  textAlign: "left",
  textDecorationLine: "none",
  whiteSpace: "nowrap",
  cursor: "pointer",
  bg: "transparent",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  transitionTimingFunction: "ease-out",
  _hover: { bg: "gray.a3", color: "fg.default", textDecorationLine: "none" },
  _active: { bg: "gray.a4" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "blue.9",
    outlineOffset: "-2px",
  },
  "&[aria-current=page]": {
    bg: "gray.a3",
    color: "fg.default",
    fontWeight: "medium",
  },
  "&[data-density=compact]": { h: "7", px: "2", gap: "2" },
  "&[data-icon-only]": { w: "8", flexShrink: "0" },
  "&[data-variant=field]": {
    bg: "gray.a3",
    _hover: { bg: "gray.a4" },
    _active: { bg: "gray.a5" },
  },
  "&[data-collapsed]": { justifyContent: "center", px: "0", gap: "0" },
  "& svg": { flexShrink: "0" },
});

export const sidebarRowLabelClass = css({
  flex: "1",
  minW: "0",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

export const sidebarShortcutClass = css({
  fontSize: "xs",
  color: "fg.subtle",
  fontFamily: "mono",
  letterSpacing: "tight",
});

/** Wraps a collapsed-rail row in a right-side tooltip carrying its label. */
export const SidebarRailTooltip = (props: {
  expanded: boolean;
  label: string;
  children: JSX.Element;
}) => (
  <Tooltip
    content={props.label}
    disabled={props.expanded}
    openDelay={150}
    closeDelay={0}
    positioning={{ placement: "right", gutter: 8 }}
  >
    {props.children}
  </Tooltip>
);

type SidebarNavLinkProps = Omit<
  JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
  "children"
> & {
  expanded: boolean;
  active: boolean;
  label: string;
  href: string;
  icon: SidebarNavIcon;
  trailing?: JSX.Element;
};

export const SidebarNavLink = (props: SidebarNavLinkProps) => {
  const [local, rest] = splitProps(props, [
    "expanded",
    "active",
    "label",
    "icon",
    "trailing",
    "class",
  ]);
  return (
    <SidebarRailTooltip expanded={local.expanded} label={local.label}>
      <a
        {...rest}
        class={`${sidebarRowClass}${local.class ? ` ${local.class}` : ""}`}
        aria-current={local.active ? "page" : undefined}
        aria-label={local.expanded ? undefined : local.label}
        data-collapsed={local.expanded ? undefined : ""}
      >
        <local.icon size={16} strokeWidth={1.8} />
        <Show when={local.expanded}>
          <Box as="span" class={sidebarRowLabelClass}>
            {local.label}
          </Box>
          {local.trailing}
        </Show>
      </a>
    </SidebarRailTooltip>
  );
};
