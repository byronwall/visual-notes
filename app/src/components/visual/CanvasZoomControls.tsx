import { MaximizeIcon, MinusIcon, PlusIcon } from "lucide-solid";
import type { Accessor, JSX, VoidComponent } from "solid-js";
import { Box, Flex } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import { Kbd } from "~/components/ui/kbd";
import { Tooltip } from "~/components/ui/tooltip";

export type CanvasZoomControlsProps = {
  scale: Accessor<number>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onResetZoom: () => void;
};

const ControlTip = (props: {
  label: string;
  keys: string;
  children: JSX.Element;
}) => (
  <Tooltip
    openDelay={350}
    closeDelay={60}
    positioning={{ placement: "top" }}
    content={
      <Flex align="center" gap="2">
        {props.label}
        <Kbd size="sm">{props.keys}</Kbd>
      </Flex>
    }
  >
    {props.children}
  </Tooltip>
);

export const CanvasZoomControls: VoidComponent<CanvasZoomControlsProps> = (
  props
) => {
  const percent = () => `${Math.round(props.scale() * 100)}%`;
  return (
    <Flex
      align="center"
      gap="0.5"
      p="1"
      bg="bg.default"
      borderRadius="l2"
      boxShadow="md"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <ControlTip label="Zoom out" keys="−">
        <IconButton
          size="xs"
          variant="plain"
          aria-label="Zoom out"
          onClick={props.onZoomOut}
        >
          <MinusIcon />
        </IconButton>
      </ControlTip>
      <ControlTip label="Reset to 100%" keys="1">
        <Box
          as="button"
          aria-label="Reset zoom to 100%"
          minW="11"
          h="7"
          px="1"
          borderRadius="l1"
          fontSize="xs"
          fontVariantNumeric="tabular-nums"
          color="fg.muted"
          cursor="pointer"
          transitionProperty="background-color, color"
          transitionDuration="fast"
          _hover={{ bg: "bg.muted", color: "fg.default" }}
          onClick={props.onResetZoom}
        >
          {percent()}
        </Box>
      </ControlTip>
      <ControlTip label="Zoom in" keys="+">
        <IconButton
          size="xs"
          variant="plain"
          aria-label="Zoom in"
          onClick={props.onZoomIn}
        >
          <PlusIcon />
        </IconButton>
      </ControlTip>
      <ControlTip label="Fit all notes" keys="F">
        <IconButton
          size="xs"
          variant="plain"
          aria-label="Fit all notes"
          onClick={props.onFit}
        >
          <MaximizeIcon />
        </IconButton>
      </ControlTip>
    </Flex>
  );
};
