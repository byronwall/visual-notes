import { MessageSquareTextIcon } from "lucide-solid";
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
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { AnnotationEntry } from "./AnnotationEntry";
import { useAnnotationLayer } from "./annotation-context";

// The list of a note's annotations. With room left of the note it is a rail
// beside the text; otherwise a count button opens it as a sheet. Entries
// follow note order; ones without a place in the text come first.

const RAIL_WIDTH = 240;
const RAIL_GAP = 24;

export const AnnotationRail: VoidComponent = () => {
  const layer = useAnnotationLayer();
  const [room, setRoom] = createSignal(false);
  const [sheetOpen, setSheetOpen] = createSignal(false);
  let anchor: HTMLDivElement | undefined;

  const ordered = createMemo(() => {
    const ranges = layer.ranges();
    const pos = (id: string) => ranges.get(id)?.from ?? -1;
    return [...layer.annotations()].sort((a, b) => pos(a.id) - pos(b.id));
  });

  // The rail sits left of the note; it needs a gutter that clears the app
  // sidebar. Measured, since the gutter depends on the window and sidebar.
  const measure = () => {
    if (!anchor) return;
    const left = anchor.getBoundingClientRect().left;
    const main = anchor.closest("main") ?? document.body;
    const bound = Math.max(0, main.getBoundingClientRect().left);
    setRoom(left - bound >= RAIL_WIDTH + RAIL_GAP + 8);
  };
  onMount(() => {
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    onCleanup(() => observer.disconnect());
  });

  // A highlight clicked while the rail is hidden opens the sheet.
  createEffect(() => {
    if (layer.activeId() && !room() && layer.annotations().some((a) => a.id === layer.activeId())) {
      setSheetOpen(true);
    }
  });

  const list = () => (
    <Stack gap="2">
      <For each={ordered()}>{(annotation) => <AnnotationEntry annotation={annotation} />}</For>
    </Stack>
  );

  return (
    <>
      <Box ref={anchor} position="absolute" top="0" left="0" w="0" h="0" aria-hidden="true" />
      <Show when={layer.annotations().length > 0}>
        <Show
          when={room()}
          fallback={
            <Button
              position="fixed"
              bottom="4"
              right="4"
              zIndex="docked"
              size="sm"
              variant="outline"
              bg="bg.default"
              boxShadow="md"
              data-testid="annotation-sheet-button"
              onClick={() => setSheetOpen(true)}
            >
              <MessageSquareTextIcon />
              {layer.annotations().length} annotations
            </Button>
          }
        >
          <Box
            position="absolute"
            top="0"
            bottom="0"
            style={{ right: `calc(100% + ${RAIL_GAP}px)`, width: `${RAIL_WIDTH}px` }}
            data-testid="annotation-rail"
          >
            <Box position="sticky" top="4" maxH="calc(100vh - 32px)" overflowY="auto" pb="2">
              <HStack justify="space-between" mb="2" fontSize="xs" color="fg.muted">
                <Box fontWeight="semibold">Annotations</Box>
                <Button size="2xs" variant="plain" onClick={() => layer.openTypes()}>
                  Types
                </Button>
              </HStack>
              {list()}
            </Box>
          </Box>
        </Show>
        <SimpleDialog
          open={sheetOpen() && !room()}
          onClose={() => setSheetOpen(false)}
          title="Annotations"
          phoneSheet
          maxW="28rem"
        >
          {list()}
        </SimpleDialog>
      </Show>
    </>
  );
};
