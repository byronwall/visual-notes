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
import { Box, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { AnnotationEntry } from "./AnnotationEntry";
import { AnnotationLegend } from "./AnnotationLegend";
import { RailHeader, RailStrip } from "./RailChrome";
import { useAnnotationLayer } from "./annotation-context";
import { layoutRail } from "./railLayout";

// A note's annotations. With a gutter left of the note they are margin notes:
// each sits beside its passage, the active one exactly level with it. The
// rail collapses to a strip of markers. Without a gutter, a legend pill opens
// a floating panel; phones get a sheet.

const RAIL_MIN = 200;
const RAIL_MAX = 300;
const RAIL_GAP = 16;
const EDGE = 8;
const STORE_KEY = "vn.annotationRail.collapsed";

const readCollapsed = () => {
  try {
    return localStorage.getItem(STORE_KEY) === "1";
  } catch {
    return false;
  }
};

export const AnnotationRail: VoidComponent = () => {
  const layer = useAnnotationLayer();
  const [railWidth, setRailWidth] = createSignal(0);
  const [phone, setPhone] = createSignal(false);
  const [panelOpen, setPanelOpen] = createSignal(false);
  const [collapsed, setCollapsedSignal] = createSignal(false);
  const [layoutTick, setLayoutTick] = createSignal(0);
  const [heights, setHeights] = createSignal(new Map<string, number>(), {
    equals: false,
  });
  const [headerHeight, setHeaderHeight] = createSignal(56);
  let anchor: HTMLDivElement | undefined;
  let railEl: HTMLDivElement | undefined;

  const setCollapsed = (value: boolean) => {
    setCollapsedSignal(value);
    // Measure again once the rail or the strip is in the page.
    requestAnimationFrame(() => setLayoutTick((n) => n + 1));
    try {
      localStorage.setItem(STORE_KEY, value ? "1" : "0");
    } catch {
      /* per-viewer convenience only */
    }
  };

  const visible = createMemo(() => {
    const focus = layer.focusType();
    const ranges = layer.ranges();
    const pos = (id: string) => ranges.get(id)?.from ?? -1;
    return layer
      .annotations()
      .filter((a) => !focus || a.typeId === focus)
      .sort((a, b) => pos(a.id) - pos(b.id));
  });
  const room = () => railWidth() >= RAIL_MIN;

  const measure = () => {
    if (!anchor) return;
    const left = anchor.getBoundingClientRect().left;
    const main = anchor.closest("main") ?? document.body;
    const bound = Math.max(0, main.getBoundingClientRect().left);
    setRailWidth(
      Math.min(RAIL_MAX, Math.floor(left - bound - RAIL_GAP - EDGE)),
    );
    setPhone(window.matchMedia("(max-width: 767px)").matches);
    setLayoutTick((n) => n + 1);
  };
  onMount(() => {
    setCollapsedSignal(readCollapsed());
    measure();
    requestAnimationFrame(() => setLayoutTick((n) => n + 1));
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    onCleanup(() => observer.disconnect());
  });
  // Images loading or blocks reflowing move passages without a transaction.
  createEffect(() => {
    const ed = layer.editor();
    if (!ed) return;
    const observer = new ResizeObserver(() => setLayoutTick((n) => n + 1));
    observer.observe(ed.view.dom);
    onCleanup(() => observer.disconnect());
  });

  // Where each passage starts, relative to the rail's top.
  const wants = createMemo(() => {
    layoutTick();
    const ed = layer.editor();
    const ranges = layer.ranges();
    const out = new Map<string, number>();
    if (!ed || !railEl || !room()) return out;
    const top = railEl.getBoundingClientRect().top;
    for (const a of visible()) {
      const range = ranges.get(a.id);
      if (!range) continue;
      try {
        out.set(a.id, ed.view.coordsAtPos(range.from).top - top - 2);
      } catch {
        /* a position the view cannot place yet */
      }
    }
    return out;
  });

  const positions = createMemo(() =>
    layoutRail(
      visible().map((a) => ({
        id: a.id,
        want: wants().get(a.id) ?? 0,
        height: heights().get(a.id) ?? 64,
      })),
      layer.activeId(),
      6,
      headerHeight() + 4,
    ),
  );
  const railHeight = () => {
    let bottom = 0;
    for (const a of visible())
      bottom = Math.max(
        bottom,
        (positions().get(a.id) ?? 0) + (heights().get(a.id) ?? 64),
      );
    return bottom;
  };

  // Entry heights feed the layout. Created on first use: the server has no
  // ResizeObserver.
  let sizes: ResizeObserver | undefined;
  const observeSize = (el: HTMLElement) => {
    sizes ??= new ResizeObserver((entries) => {
      const next = heights();
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.annotationId;
        if (id)
          next.set(
            id,
            Math.ceil(
              entry.borderBoxSize?.[0]?.blockSize ??
                entry.target.getBoundingClientRect().height,
            ),
          );
      }
      setHeights(next);
    });
    sizes.observe(el);
  };
  onCleanup(() => sizes?.disconnect());

  // A highlight clicked while the list is hidden opens it.
  createEffect(() => {
    const id = layer.activeId();
    if (!id || !layer.annotations().some((a) => a.id === id)) return;
    if (room() && collapsed()) setCollapsed(false);
    if (!room()) setPanelOpen(true);
  });

  // Escape lets go of the active note (the composer handles its own).
  createEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target as Element | null;
      if (
        target?.closest(
          "input, textarea, [data-scope=select], [data-scope=menu]",
        )
      )
        return;
      if (layer.activeId()) layer.setActive(null);
      else if (panelOpen() && !phone()) setPanelOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    onCleanup(() => document.removeEventListener("keydown", onKeyDown));
  });

  const list = () => (
    <Stack gap="1">
      <For each={visible()}>
        {(annotation) => <AnnotationEntry annotation={annotation} />}
      </For>
    </Stack>
  );

  return (
    <>
      <Box
        ref={anchor}
        position="absolute"
        top="0"
        left="0"
        w="0"
        h="0"
        aria-hidden="true"
      />
      <Show when={layer.annotations().length > 0}>
        <Show when={room() && !collapsed()}>
          <Box
            ref={railEl}
            position="absolute"
            top="0"
            bottom="0"
            style={{
              right: `calc(100% + ${RAIL_GAP}px)`,
              width: `${railWidth()}px`,
            }}
            data-testid="annotation-rail"
          >
            <RailHeader
              onCollapse={() => setCollapsed(true)}
              onHeight={setHeaderHeight}
            />
            <Box
              position="absolute"
              top="0"
              left="0"
              right="0"
              style={{ height: `${railHeight()}px` }}
            >
              <For each={visible()}>
                {(annotation) => (
                  <AnnotationEntry
                    annotation={annotation}
                    aligned
                    ref={observeSize}
                    style={{
                      position: "absolute",
                      left: "0",
                      right: "0",
                      top: `${positions().get(annotation.id) ?? 0}px`,
                      transition: "top 160ms ease-out",
                    }}
                  />
                )}
              </For>
            </Box>
          </Box>
        </Show>

        <Show when={room() && collapsed()}>
          <Box
            ref={railEl}
            position="absolute"
            top="0"
            bottom="0"
            style={{ right: `calc(100% + ${RAIL_GAP}px)`, width: "24px" }}
          >
            <RailStrip
              wants={wants()}
              onExpand={(id) => {
                setCollapsed(false);
                if (id) layer.reveal(id);
              }}
            />
          </Box>
        </Show>

        <Show when={!room()}>
          <Portal>
            <Show
              when={panelOpen() && !phone()}
              fallback={
                <Show when={!panelOpen()}>
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
                </Show>
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
                p="2"
                bg="bg.default"
                borderWidth="1px"
                borderColor="border"
                borderRadius="l3"
                boxShadow="lg"
                data-testid="annotation-panel"
              >
                <RailHeader onClose={() => setPanelOpen(false)} />
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
              <AnnotationLegend wrap filter />
              {list()}
            </Stack>
          </SimpleDialog>
        </Show>
      </Show>
    </>
  );
};
