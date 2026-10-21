import { A } from "@solidjs/router";
import { Maximize2Icon, XIcon } from "lucide-solid";
import { type VoidComponent } from "solid-js";
import { Box } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import { Tooltip } from "~/components/ui/tooltip";

const iconButtonProps = {
  size: "xs",
  variant: "plain",
  colorPalette: "gray",
  minW: "7",
  w: "7",
  h: "7",
  color: "fg.muted",
} as const;

/**
 * What a side panel adds to the shared note header: open the note as a full
 * page, and close the panel. Separated from the note actions by a hairline.
 */
export const DocPanelActions: VoidComponent<{
  fullPageHref: string;
  onClose: () => void;
}> = (props) => (
  <>
    <Box w="1px" h="4" bg="border" mx="1" aria-hidden="true" />
    <Tooltip
      content="Open full page"
      showArrow
      portalled={false}
      contentProps={{ zIndex: "tooltip" }}
    >
      <IconButton
        {...iconButtonProps}
        asChild={(linkProps) => (
          <A {...linkProps()} href={props.fullPageHref} />
        )}
        aria-label="Open full page"
      >
        <Maximize2Icon size={14} />
      </IconButton>
    </Tooltip>
    <Tooltip
      content="Close (Esc)"
      showArrow
      portalled={false}
      contentProps={{ zIndex: "tooltip" }}
    >
      <IconButton
        {...iconButtonProps}
        aria-label="Close panel"
        onClick={() => props.onClose()}
      >
        <XIcon size={16} />
      </IconButton>
    </Tooltip>
  </>
);
