import { For, Show, createSignal, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { LayoutGridIcon, MapIcon, NetworkIcon, ChevronRightIcon } from "lucide-solid";
import * as Menu from "~/components/ui/menu";
import { Button } from "~/components/ui/button";
import { Box, VisuallyHidden } from "styled-system/jsx";
import {
  sidebarNavButtonStyle,
  type SidebarNavIcon,
} from "./SidebarNavButton";

type CanvasMenuItem = {
  label: string;
  href: string;
  icon: SidebarNavIcon;
};

const canvasChildren: CanvasMenuItem[] = [
  {
    label: "Embeddings",
    href: "/embeddings",
    icon: NetworkIcon,
  },
  {
    label: "UMAP",
    href: "/umap",
    icon: MapIcon,
  },
];

export const isCanvasSectionActive = (pathname: string) =>
  pathname === "/canvas" ||
  pathname.startsWith("/canvas/") ||
  pathname === "/embeddings" ||
  pathname.startsWith("/embeddings/") ||
  pathname === "/umap" ||
  pathname.startsWith("/umap/");

export const AppSidebarCanvasMenu = (props: {
  expanded: boolean;
  pathname: string;
  onNavigate: (href: string) => void;
}) => {
  const [open, setOpen] = createSignal(false);
  let closeTimer: number | undefined;

  const clearCloseTimer = () => {
    if (closeTimer === undefined) return;
    window.clearTimeout(closeTimer);
    closeTimer = undefined;
  };

  const openMenu = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer = window.setTimeout(() => {
      setOpen(false);
      closeTimer = undefined;
    }, 140);
  };

  onCleanup(() => clearCloseTimer());

  return (
    <Box onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
      <Menu.Root
        size="sm"
        open={open()}
        onOpenChange={(details) => setOpen(details.open)}
        positioning={{ placement: "right-start", gutter: 4 }}
      >
        <Menu.Trigger
          asChild={(triggerProps) => (
            <Button
              {...triggerProps}
              variant="plain"
              size="sm"
              aria-current={isCanvasSectionActive(props.pathname) ? "page" : undefined}
              px={props.expanded ? "3" : "2"}
              py="2"
              w="full"
              display="flex"
              alignItems="center"
              justifyContent={props.expanded ? "flex-start" : "center"}
              gap={props.expanded ? "2" : "0"}
              onClick={() => props.onNavigate("/canvas")}
              title="Canvas"
              {...sidebarNavButtonStyle(isCanvasSectionActive(props.pathname))}
            >
              <LayoutGridIcon size={18} strokeWidth={1.8} aria-hidden="true" />
              <Show when={props.expanded}>
                <Box as="span">Canvas</Box>
                <Box as="span" ml="auto">
                  <ChevronRightIcon size={14} />
                </Box>
              </Show>
              <Show when={!props.expanded}>
                <VisuallyHidden>Canvas menu</VisuallyHidden>
              </Show>
            </Button>
          )}
        />
        <Portal>
          <Menu.Positioner zIndex="tooltip">
            <Menu.Content zIndex="tooltip" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
              <For each={canvasChildren}>
                {(item) => (
                  <Menu.Item value={item.href} onSelect={() => props.onNavigate(item.href)}>
                    {item.label}
                  </Menu.Item>
                )}
              </For>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </Box>
  );
};
