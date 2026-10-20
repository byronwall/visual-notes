import { For, createSignal, type Accessor } from "solid-js";
import { ListTreeIcon } from "lucide-solid";
import { css } from "styled-system/css";
import { Box } from "styled-system/jsx";
import * as Drawer from "~/components/ui/drawer";
import { mobileBarButtonClass } from "~/components/sidebar/mobile-app-bar";
import { type TocItem } from "./types";

type Props = {
  items: Accessor<TocItem[]>;
  activeIndex: Accessor<number>;
  minHeadingLevel: Accessor<TocItem["level"]>;
  onItemClick: (item: TocItem) => void;
};

const itemClass = css({
  display: "block",
  w: "full",
  textAlign: "left",
  py: "2.5",
  pr: "3",
  borderRadius: "l2",
  fontSize: "md",
  lineHeight: "snug",
  color: "fg.muted",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "gray.a3", color: "fg.default" },
  _active: { bg: "gray.a4" },
  "&[data-depth='0']": { color: "fg.default", fontWeight: "medium" },
  "&[data-active=true]": {
    bg: "gray.a3",
    color: "fg.default",
    fontWeight: "semibold",
  },
  _motionReduce: { transition: "none" },
});

/**
 * Phone table of contents: an app-bar button that opens a bottom sheet of
 * the note's headings. Replaces the desktop rail, which would sit on top of
 * the text at phone width.
 */
export function TocMobileSheet(props: Props) {
  const [open, setOpen] = createSignal(false);
  let triggerEl: HTMLButtonElement | undefined;

  const depth = (item: TocItem) =>
    Math.min(Math.max(item.level - props.minHeadingLevel(), 0), 3);

  const jumpTo = (item: TocItem) => {
    setOpen(false);
    // Scroll after the sheet starts closing so focus restore can't fight it.
    window.requestAnimationFrame(() => props.onItemClick(item));
  };

  return (
    <>
      <button
        type="button"
        ref={(element) => (triggerEl = element)}
        class={mobileBarButtonClass}
        aria-label="Contents"
        aria-expanded={open()}
        onClick={() => setOpen(true)}
      >
        <ListTreeIcon size={18} strokeWidth={1.8} />
      </button>
      <Drawer.Root
        open={open()}
        onOpenChange={(details) => setOpen(details.open)}
        placement="bottom"
        finalFocusEl={() => triggerEl ?? null}
      >
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content
            maxH="72dvh"
            borderTopRadius="l3"
            pb="env(safe-area-inset-bottom)"
          >
            <Drawer.Header pt="3" pb="1" px="4">
              <Box
                aria-hidden="true"
                alignSelf="center"
                w="9"
                h="1"
                mb="2"
                borderRadius="full"
                bg="gray.a5"
              />
              <Drawer.Title textStyle="sm" color="fg.muted">
                Contents
              </Drawer.Title>
            </Drawer.Header>
            <Drawer.Body p="2" pt="0" alignItems="stretch">
              <nav aria-label="Contents">
                <For each={props.items()}>
                  {(item, index) => (
                    <button
                      type="button"
                      class={itemClass}
                      data-depth={depth(item)}
                      data-active={index() === props.activeIndex()}
                      aria-current={
                        index() === props.activeIndex() ? "location" : undefined
                      }
                      style={{ "padding-left": `${12 + depth(item) * 16}px` }}
                      ref={(element) => {
                        // Open with the current section in view.
                        if (index() !== props.activeIndex()) return;
                        queueMicrotask(() =>
                          element.scrollIntoView({ block: "nearest" }),
                        );
                      }}
                      onClick={() => jumpTo(item)}
                    >
                      {item.text}
                    </button>
                  )}
                </For>
              </nav>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </>
  );
}
