import { Accessor, JSX, splitProps } from "solid-js";
import { Portal } from "solid-js/web";
import * as ArkPopover from "~/components/ui/popover";
import { WrapWhen } from "./WrapWhen";
import { PopoverRootProps } from "@ark-ui/solid/popover";

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
    <ArkPopover.Root
      open={local.open}
      onOpenChange={(details) => {
        if (!details.open) {
          console.log("[Popover] close");
          local.onClose();
        }
      }}
      positioning={positioning()}
    >
      <ArkPopover.Anchor>{local.anchor}</ArkPopover.Anchor>
      <WrapWhen when={portalled()} component={Portal}>
        <ArkPopover.Positioner>
          <ArkPopover.Content class={local.class} style={local.style}>
            {local.children}
          </ArkPopover.Content>
        </ArkPopover.Positioner>
      </WrapWhen>
    </ArkPopover.Root>
  );
};
