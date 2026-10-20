import { Accessor, JSX, splitProps } from "solid-js";
import { Portal } from "solid-js/web";
import { WrapWhen } from "./WrapWhen";
import * as Popover from "./popover";
import { PopoverRootProps } from "@ark-ui/solid";

type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

type PopoverProps = {
  open: boolean;
  onClose: () => void;
  anchor: JSX.Element;
  placement?: Placement;
  offset?: number;
  class?: string;
  style?: JSX.CSSProperties;
  children: JSX.Element;
  portalled?: boolean;
  portalRef?: HTMLElement | undefined;
  /** Element to focus when the popover opens (defaults to the first focusable). */
  initialFocusEl?: () => HTMLElement | null;
  /** Class for the anchor wrapper, e.g. to let it shrink inside a flex row. */
  anchorClass?: string;
  /** Call `event.preventDefault()` to keep the popover open on this Escape. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
};

export const SimplePopover = (props: PopoverProps) => {
  const [local] = splitProps(props, [
    "open",
    "onClose",
    "anchor",
    "placement",
    "offset",
    "class",
    "style",
    "children",
    "portalled",
    "portalRef",
    "initialFocusEl",
    "anchorClass",
    "onEscapeKeyDown",
  ]);

  const portalled = () => local.portalled ?? true;

  const positioning: Accessor<PopoverRootProps["positioning"]> = () => {
    const base = { placement: local.placement ?? "bottom-start" };
    if (typeof local.offset === "number") {
      return { ...base, offset: { mainAxis: local.offset } };
    }
    return base;
  };

  return (
    <Popover.Root
      open={local.open}
      onOpenChange={(details) => {
        if (!details.open) {
          local.onClose();
        }
      }}
      positioning={positioning()}
      initialFocusEl={local.initialFocusEl}
      onEscapeKeyDown={(event) => local.onEscapeKeyDown?.(event)}
    >
      <Popover.Anchor class={local.anchorClass}>{local.anchor}</Popover.Anchor>
      <WrapWhen when={portalled()} component={Portal}>
        <Popover.Positioner>
          <Popover.Content class={local.class} style={local.style}>
            {local.children}
          </Popover.Content>
        </Popover.Positioner>
      </WrapWhen>
    </Popover.Root>
  );
};
