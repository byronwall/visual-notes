import { XIcon } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  type VoidComponent,
} from "solid-js";
import { Portal } from "solid-js/web";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { AnnotationEntry } from "./AnnotationEntry";
import { AnnotationLegend } from "./AnnotationLegend";
import { useAnnotationLayer } from "./annotation-context";

// The list of a note's annotations. With a gutter left of the note it is a
// rail beside the text, sized to the gutter. Without one, a legend pill opens
// it as a floating panel that leaves the note usable; phones get a sheet.
// Entries follow note order; ones without a place in the text come first.

const RAIL_MIN = 200;
const RAIL_MAX = 300;
const RAIL_GAP = 16;
/** Space kept between the rail and whatever sits left of the note. */
const EDGE = 8;

export const AnnotationRail: VoidComponent = () => {
  const layer = useAnnotationLayer();
  const [railWidth, setRailWidth] = createSignal(0);
  const [phone, setPhone] = createSignal(false);
  const [panelOpen, setPanelOpen] = createSignal(false);
  let anchor: HTMLDivElement | undefined;

  const ordered = createMemo(() => {
    const ranges = layer.ranges();
    const pos = (id: string) => ranges.get(id)?.from ?? -1;
    return [...layer.annotations()].sort((a, b) => pos(a.id) - pos(b.id));
  });
  const room = () => railWidth() >= RAIL_MIN;

  // The gutter depends on the window and the app sidebar, so measure it.
  const measure = () => {
    if (!anchor) return;
    const left = anchor.getBoundingClientRect().left;
    const main = anchor.closest("main") ?? document.body;
    const bound = Math.max(0, main.getBoundingClientRect().left);
    setRailWidth(Math.min(RAIL_MAX, Math.floor(left - bound - RAIL_GAP - EDGE)));
    setPhone(window.matchMedia("(max-width: 767px)").matches);
  };
  onMount(() => {
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    onCleanup(() => observer.disconnect());
  });

  // A highlight clicked while the rail is hidden opens the panel.
  createEffect(() => {
    if (layer.activeId() && !room() && layer.annotations().some((a) => a.id === layer.activeId())) {
      setPanelOpen(true);
    }
  });

  createEffect(() => {
    if (!panelOpen() || phone()) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    onCleanup(() => document.removeEventListener("keydown", onKeyDown));
  });

  const list = () => (
    <Stack gap="2">
      <For each={ordered()}>{(annotation) => <AnnotationEntry annotation={annotation} />}</For>
    </Stack>
  );

  const header = (close?: () => void) => (
    <Stack gap="1.5" mb="2">
      <HStack justify="space-between" fontSize="xs" color="fg.muted">
        <Box fontWeight="semibold" color="fg.default">
          Annotations
        </Box>
        <HStack gap="0.5">
          <Button size="2xs" variant="plain" onClick={() => layer.openTypes()}>
            Types
          </Button>
          <Show when={close}>
            <IconButton size="2xs" variant="plain" aria-label="Close annotations" onClick={() => close?.()}>
              <XIcon />
            </IconButton>
          </Show>
        </HStack>
      </HStack>
      <AnnotationLegend wrap />
    </Stack>
  );

  return (
    <>
      <Box ref={anchor} position="absolute" top="0" left="0" w="0" h="0" aria-hidden="true" />
      <Show when={layer.annotations().length > 0}>
        <Show when={room()}>
          <Box
            position="absolute"
            top="0"
            bottom="0"
            style={{ right: `calc(100% + ${RAIL_GAP}px)`, width: `${railWidth()}px` }}
            data-testid="annotation-rail"
          >
            <Box position="sticky" top="4" maxH="calc(100vh - 32px)" overflowY="auto" pb="2">
              {header()}
              {list()}
            </Box>
          </Box>
        </Show>

        <Show when={!room()}>
          <Portal>
            <Show
              when={panelOpen() && !phone()}
              fallback={
                <Button
                  position="fixed"
                  bottom="4"
                  right="4"
                  zIndex="popover"
                  size="sm"
                  variant="outline"
                  bg="bg.default"
                  boxShadow="md"
                  data-testid="annotation-sheet-button"
                  aria-label={`${layer.annotations().length} annotations`}
                  onClick={() => setPanelOpen(true)}
                >
                  <AnnotationLegend />
                </Button>
              }
            >
              <Box
                position="fixed"
                bottom="4"
                right="4"
                zIndex="popover"
                w="80"
                maxW="calc(100vw - 32px)"
                maxH="min(70vh, 640px)"
                overflowY="auto"
                p="3"
                bg="bg.default"
                borderWidth="1px"
                borderColor="border"
                borderRadius="l3"
                boxShadow="lg"
                data-testid="annotation-panel"
              >
                {header(() => setPanelOpen(false))}
                {list()}
              </Box>
            </Show>
          </Portal>
          <SimpleDialog
            open={panelOpen() && phone()}
            onClose={() => setPanelOpen(false)}
            title="Annotations"
            phoneSheet
          >
            <Stack gap="2">
              <AnnotationLegend wrap />
              {list()}
            </Stack>
          </SimpleDialog>
        </Show>
      </Show>
    </>
  );
};
