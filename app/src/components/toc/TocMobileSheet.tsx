import { createSignal } from "solid-js";
import { ListTreeIcon } from "lucide-solid";
import { Box } from "styled-system/jsx";
import * as Drawer from "~/components/ui/drawer";
import { mobileBarButtonClass } from "~/components/sidebar/mobile-app-bar";
import { TocOutline } from "./TocOutline";
import { type TocItem } from "./types";
import { type TocController } from "./useTocController";

/**
 * Phone table of contents: an app-bar button that opens a bottom sheet of
 * the note's headings. Replaces the desktop outline, which would sit on top
 * of the text at phone width.
 */
export function TocMobileSheet(props: { toc: TocController }) {
  const [open, setOpen] = createSignal(false);
  let triggerEl: HTMLButtonElement | undefined;
  let contentEl: HTMLDivElement | undefined;

  const jumpTo = (item: TocItem) => {
    setOpen(false);
    // Scroll after the sheet starts closing so focus restore can't fight it.
    window.requestAnimationFrame(() => props.toc.onItemClick(item));
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
        // Land on the current section, not the filter, so the phone
        // keyboard stays closed until the user asks for it.
        initialFocusEl={() =>
          contentEl?.querySelector<HTMLElement>("[aria-current=location]") ??
          contentEl ??
          null
        }
      >
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content
            ref={contentEl}
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
                borderRadius="full"
                bg="gray.a5"
              />
              <Drawer.Title srOnly>Contents</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body
              p="2"
              pt="0"
              alignItems="stretch"
              overflow="hidden"
              minH="0"
            >
              <TocOutline toc={props.toc} touch onSelect={jumpTo} />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </>
  );
}
