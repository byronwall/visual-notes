import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { Button } from "~/components/ui/button";
import { Box, VisuallyHidden } from "styled-system/jsx";

export type SidebarNavIcon = (props: {
  size?: number;
  strokeWidth?: number;
}) => JSX.Element;

export const sidebarNavButtonStyle = (active: boolean) => ({
  bg: active ? "bg.muted" : "transparent",
  color: active ? "fg.default" : "fg.muted",
  borderRadius: "l2",
  _hover: {
    bg: "bg.muted",
    color: "fg.default",
  },
});

export const SidebarNavButton = (props: {
  expanded: boolean;
  active: boolean;
  label: string;
  title?: string;
  icon: SidebarNavIcon;
  onClick: () => void;
  trailing?: JSX.Element;
}) => {
  return (
    <Button
      variant="plain"
      size="sm"
      aria-current={props.active ? "page" : undefined}
      onClick={props.onClick}
      px={props.expanded ? "3" : "2"}
      py="2"
      w="full"
      display="flex"
      alignItems="center"
      justifyContent={props.expanded ? "flex-start" : "center"}
      gap={props.expanded ? "2" : "0"}
      title={props.title || props.label}
      {...sidebarNavButtonStyle(props.active)}
    >
      <props.icon size={18} strokeWidth={1.8} aria-hidden="true" />
      <Show when={props.expanded}>
        <Box as="span">{props.label}</Box>
        <Show when={props.trailing}>{props.trailing}</Show>
      </Show>
      <Show when={!props.expanded}>
        <VisuallyHidden>{props.label}</VisuallyHidden>
      </Show>
    </Button>
  );
};
