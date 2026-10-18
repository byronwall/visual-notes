import { For, Show, createSignal, createUniqueId, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import * as HoverCard from "~/components/ui/hover-card";

type Placement = "bottom-start" | "right-start" | "top-start";

const contentClass = css({
  // Content-sized, capped to the viewport for very long paths.
  maxW: "min(420px, calc(100vw - 32px))",
  px: "3",
  py: "2",
  gap: "1",
});

const pathClass = css({
  fontFamily: "mono",
  fontSize: "13px",
  lineHeight: "1.45",
  color: "fg.muted",
  overflowWrap: "anywhere",
  "& [data-leaf]": { color: "fg.default", fontWeight: "medium" },
});

const metaClass = css({
  fontSize: "xs",
  color: "fg.subtle",
  fontVariantNumeric: "tabular-nums",
});

/** Pointer/focus handlers and ARIA wiring to spread onto the trigger link. */
export type PathHoverTriggerProps = JSX.HTMLAttributes<HTMLAnchorElement>;

const isClipped = (el: HTMLElement | null) => !!el && el.scrollWidth > el.clientWidth + 1;

/**
 * Shows the full dotted path when a mono path is clipped by an ellipsis.
 * Untruncated paths never open the card, so short rows stay quiet.
 */
export const PathHoverCard = (props: {
  path: string;
  meta?: JSX.Element;
  placement?: Placement;
  /** The clipped element, when it is not the trigger itself. */
  clippedSelector?: string;
  children: (triggerProps: PathHoverTriggerProps) => JSX.Element;
}) => {
  const [open, setOpen] = createSignal(false);
  const triggerId = `path-hover-${createUniqueId()}`;
  const segments = () => props.path.split(".");

  const needsCard = () => {
    const trigger = document.getElementById(triggerId);
    const clipped = props.clippedSelector
      ? trigger?.querySelector<HTMLElement>(props.clippedSelector) ?? null
      : trigger;
    return isClipped(clipped);
  };

  return (
    <HoverCard.Root
      ids={{ trigger: triggerId }}
      open={open()}
      onOpenChange={(details) => setOpen(details.open && needsCard())}
      openDelay={350}
      closeDelay={100}
      positioning={{
        placement: props.placement ?? "bottom-start",
        offset: { mainAxis: 6 },
        strategy: "fixed",
      }}
    >
      <HoverCard.Trigger
        asChild={(triggerProps) => props.children(triggerProps as PathHoverTriggerProps)}
      />
      {/* Only mounted once opened by a pointer/focus, which never happens during SSR. */}
      <Show when={open()}>
        <Portal>
          <HoverCard.Positioner>
            <HoverCard.Content class={contentClass} data-path-hover-card>
              <p class={pathClass}>
                <For each={segments()}>
                  {(segment, index) => (
                    <>
                      <Show when={index() > 0}>
                        .<wbr />
                      </Show>
                      <span data-leaf={index() === segments().length - 1 ? "" : undefined}>
                        {segment}
                      </span>
                    </>
                  )}
                </For>
              </p>
              <Show when={props.meta}>
                <p class={metaClass}>{props.meta}</p>
              </Show>
            </HoverCard.Content>
          </HoverCard.Positioner>
        </Portal>
      </Show>
    </HoverCard.Root>
  );
};
