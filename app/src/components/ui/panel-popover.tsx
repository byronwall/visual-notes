import { Accessor, JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { PopoverRootProps } from "@ark-ui/solid";
import { WrapWhen } from "./WrapWhen";
import * as Popover from "./popover";

type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

type PanelPopoverProps = {
  open: boolean;
  onClose: () => void;
  anchor: JSX.Element;
  title?: string;
  description?: string;
  placement?: Placement;
  offset?: number;
  width?: string;
  children: JSX.Element;
  footer?: JSX.Element;
  portalled?: boolean;
};

export const PanelPopover = (props: PanelPopoverProps) => {
  const portalled = () => props.portalled ?? true;

  const positioning: Accessor<PopoverRootProps["positioning"]> = () => {
    const base = { placement: props.placement ?? "bottom-start" };
    if (typeof props.offset === "number") {
      return { ...base, offset: { mainAxis: props.offset } };
    }
    return base;
  };

  return (
    <Popover.Root
      open={props.open}
      onOpenChange={(details) => {
        if (!details.open) props.onClose();
      }}
      positioning={positioning()}
    >
      <Popover.Anchor>{props.anchor}</Popover.Anchor>
      <WrapWhen when={portalled()} component={Portal}>
        <Popover.Positioner>
          <Popover.Content style={{ width: props.width ?? "24rem" }}>
            <Popover.Header>
              <Popover.Title>{props.title ?? "Menu"}</Popover.Title>
              <Popover.Description>{props.description ?? ""}</Popover.Description>
            </Popover.Header>
            <Popover.Body>{props.children}</Popover.Body>
            {props.footer ? <Popover.Footer>{props.footer}</Popover.Footer> : null}
          </Popover.Content>
        </Popover.Positioner>
      </WrapWhen>
    </Popover.Root>
  );
};

