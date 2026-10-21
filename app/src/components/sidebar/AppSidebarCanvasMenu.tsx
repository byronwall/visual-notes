import { For, Show, createSignal, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { ChevronRightIcon } from "lucide-solid";
import * as Menu from "~/components/ui/menu";
import { Box } from "styled-system/jsx";
import {
  CANVAS_CHILD_DESTINATIONS,
  CANVAS_DESTINATION,
  isCanvasSectionActive,
} from "./nav-items";
import { sidebarRowClass, sidebarRowLabelClass } from "./SidebarNavLink";

/**
 * Canvas row: a real link to /canvas plus a hover flyout with the other
 * spatial views (Embeddings, UMAP). Controlled `Menu.Root` + `Portal` per
 * AGENTS.md so the flyout escapes the sidebar stacking context.
 */
export const AppSidebarCanvasMenu = (props: {
  expanded: boolean;
  pathname: string;
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

  const active = () => isCanvasSectionActive(props.pathname);

  return (
    <Box onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
      <Menu.Root
        size="sm"
        open={open()}
        onOpenChange={(details) => setOpen(details.open)}
        positioning={{ placement: "right-start", gutter: 6 }}
      >
        <Menu.Trigger
          asChild={(triggerProps) => (
            <a
              {...triggerProps}
              href={CANVAS_DESTINATION.href}
              class={sidebarRowClass}
              aria-current={active() ? "page" : undefined}
              aria-label={props.expanded ? undefined : "Canvas"}
              data-collapsed={props.expanded ? undefined : ""}
              data-density="compact"
            >
              <CANVAS_DESTINATION.icon size={16} strokeWidth={1.8} />
              <Show when={props.expanded}>
                <Box as="span" class={sidebarRowLabelClass}>
                  {CANVAS_DESTINATION.label}
                </Box>
                <Box as="span" display="inline-flex" color="fg.subtle">
                  <ChevronRightIcon size={12} />
                </Box>
              </Show>
            </a>
          )}
        />
        <Portal>
          <Menu.Positioner zIndex="tooltip">
            <Menu.Content
              zIndex="tooltip"
              minW="40"
              onMouseEnter={openMenu}
              onMouseLeave={scheduleClose}
            >
              <For each={[CANVAS_DESTINATION, ...CANVAS_CHILD_DESTINATIONS]}>
                {(item) => (
                  <Menu.Item
                    value={item.href}
                    asChild={(itemProps) => (
                      <a
                        {...itemProps}
                        href={item.href}
                        aria-current={
                          item.isActive(props.pathname) ? "page" : undefined
                        }
                      >
                        <item.icon size={14} strokeWidth={1.8} />
                        {item.label}
                      </a>
                    )}
                  />
                )}
              </For>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </Box>
  );
};
