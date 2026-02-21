import type { JSX } from "solid-js";
import { IconButton } from "~/components/ui/icon-button";
import { Tooltip } from "~/components/ui/tooltip";
import { VisuallyHidden } from "styled-system/jsx";

export const SidebarFooterIconLink = (props: {
  label: string;
  active?: boolean;
  onClick: () => void;
  icon: JSX.Element;
  variant?: "plain" | "outline" | "subtle" | "solid";
  colorPalette?: "red" | "gray" | "blue" | "green" | "amber";
  color?: string;
  hoverColor?: string;
}) => {
  const active = () => props.active === true;
  const resolvedColor =
    props.color ?? (props.colorPalette ? undefined : active() ? "fg.default" : "fg.muted");

  return (
    <Tooltip content={props.label} showArrow>
      <IconButton
        variant={props.variant || "plain"}
        size="sm"
        colorPalette={props.colorPalette}
        onClick={props.onClick}
        bg={active() ? "bg.muted" : "transparent"}
        color={resolvedColor}
        _hover={{ bg: "bg.muted", color: props.hoverColor || "fg.default" }}
        title={props.label}
        aria-label={props.label}
        minW="8"
        h="8"
      >
        {props.icon}
        <VisuallyHidden>{props.label}</VisuallyHidden>
      </IconButton>
    </Tooltip>
  );
};
