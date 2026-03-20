import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import type { VoidComponent } from "solid-js";
import { Box, Grid, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import Modal from "~/components/Modal";

type Point = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundTo(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildImageFilename(value: string) {
  const stem = String(value || "image")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${stem || "image"}.png`;
}

export const ImagePreviewModal: VoidComponent<{
  open: boolean;
  images: string[];
  initialIndex?: number;
  alt?: string;
  title?: string;
  onClose: () => void;
}> = (props) => {
  const [zoom, setZoom] = createSignal(1);
  const [pan, setPan] = createSignal<Point>({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = createSignal<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });
  const [viewportSize, setViewportSize] = createSignal<{
    w: number;
    h: number;
  }>({ w: 0, h: 0 });
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [dragging, setDragging] = createSignal(false);
  const [pendingFit, setPendingFit] = createSignal(false);

  let viewportEl: HTMLDivElement | undefined;
  let imageEl: HTMLImageElement | undefined;
  let dragStart: { pointer: Point; pan: Point } | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const minZoom = 0.1;
  const maxZoom = 8;
  const images = createMemo(() =>
    props.images
      .map((value) => value.trim())
      .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index),
  );
  const currentSrc = createMemo(() => images()[activeIndex()] ?? "");
  const canCycle = createMemo(() => images().length > 1);

  const getFitZoom = () => {
    const v = viewportSize();
    const n = naturalSize();
    if (!v.w || !v.h || !n.w || !n.h) return 1;
    const gutter = 16;
    const fitScale = Math.min((v.w - gutter) / n.w, (v.h - gutter) / n.h, 1);
    return clamp(roundTo(fitScale), minZoom, maxZoom);
  };

  const setZoomAround = (next: number, anchor: Point) => {
    const prevZoom = zoom();
    const prevPan = pan();
    const z = clamp(next, minZoom, maxZoom);
    if (z === prevZoom) return;

    // Keep the image point under the anchor stable while zooming.
    const imagePoint = {
      x: (anchor.x - prevPan.x) / prevZoom,
      y: (anchor.y - prevPan.y) / prevZoom,
    };
    const nextPan = {
      x: anchor.x - imagePoint.x * z,
      y: anchor.y - imagePoint.y * z,
    };

    setZoom(z);
    setPan(nextPan);
  };

  const centerPanForZoom = (z: number) => {
    const v = viewportSize();
    const n = naturalSize();
    if (!v.w || !v.h || !n.w || !n.h) return;
    setPan({
      x: (v.w - n.w * z) / 2,
      y: (v.h - n.h * z) / 2,
    });
  };

  const zoomTo = (z: number) => {
    const v = viewportSize();
    // Default anchor is viewport center.
    setZoomAround(z, { x: v.w / 2, y: v.h / 2 });
  };

  const fitToViewport = () => {
    const z = getFitZoom();
    setZoom(z);
    centerPanForZoom(z);
  };

  const resetView = () => {
    setZoom(1);
    centerPanForZoom(1);
  };

  const handleZoomIn = () => zoomTo(zoom() * 1.15);
  const handleZoomOut = () => zoomTo(zoom() / 1.15);
  const handleZoomReset = () => resetView();
  const handleZoomFit = () => fitToViewport();
  const handleClose = () => props.onClose();
  const handleDownload = () => {
    if (!currentSrc() || typeof document === "undefined") return;
    const link = document.createElement("a");
    link.href = currentSrc();
    link.download = buildImageFilename(props.title || props.alt || "image");
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  const handleCopy = async () => {
    if (!currentSrc() || typeof navigator === "undefined" || !navigator.clipboard?.write) {
      return;
    }
    try {
      const response = await fetch(currentSrc());
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type || "image/png"]: blob,
        }),
      ]);
    } catch (error) {
      console.warn("[image-preview] copy failed", error);
    }
  };

  const cycleImage = (direction: -1 | 1) => {
    const nextImages = images();
    if (!nextImages.length) return;
    setActiveIndex((current) => (current + direction + nextImages.length) % nextImages.length);
  };

  const handleWheel = (e: WheelEvent) => {
    if (!props.open) return;
    if (!viewportEl) return;
    e.preventDefault();
    const rect = viewportEl.getBoundingClientRect();
    const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const delta = clamp(e.deltaY, -80, 80);
    const intensity = e.ctrlKey ? 0.0011 : 0.0008;
    const factor = Math.exp(-delta * intensity);
    setZoomAround(zoom() * factor, anchor);
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (!props.open) return;
    if (!viewportEl) return;
    if (e.button !== 0) return;
    e.preventDefault();
    viewportEl.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart = {
      pointer: { x: e.clientX, y: e.clientY },
      pan: pan(),
    };
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!dragging()) return;
    if (!dragStart) return;
    e.preventDefault();
    const dx = e.clientX - dragStart.pointer.x;
    const dy = e.clientY - dragStart.pointer.y;
    setPan({ x: dragStart.pan.x + dx, y: dragStart.pan.y + dy });
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!dragging()) return;
    if (!viewportEl) return;
    e.preventDefault();
    setDragging(false);
    dragStart = null;
    viewportEl.releasePointerCapture(e.pointerId);
  };

  const handleImageLoad = (e: Event) => {
    const img = e.currentTarget as HTMLImageElement;
    syncNaturalSize(img);
  };

  const syncNaturalSize = (img = imageEl) => {
    if (!img) return;
    const width = img.naturalWidth || 0;
    const height = img.naturalHeight || 0;
    if (!width || !height) return;
    setNaturalSize({ w: width, h: height });
  };

  const updateViewportSize = () => {
    if (!viewportEl) return;
    setViewportSize({
      w: viewportEl.clientWidth || 0,
      h: viewportEl.clientHeight || 0,
    });
  };

  const setViewportRef = (el: HTMLDivElement) => {
    viewportEl = el;
    resizeObserver?.disconnect();
    updateViewportSize();
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => updateViewportSize());
      resizeObserver.observe(el);
    }
  };

  onCleanup(() => resizeObserver?.disconnect());

  createEffect(() => {
    if (!props.open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!canCycle()) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        cycleImage(-1);
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        cycleImage(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  createEffect(() => {
    if (!props.open) return;
    const nextImages = images();
    const clampedIndex = Math.max(
      0,
      Math.min(props.initialIndex ?? 0, Math.max(0, nextImages.length - 1)),
    );
    setActiveIndex(clampedIndex);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNaturalSize({ w: 0, h: 0 });
    setPendingFit(true);
    queueMicrotask(() => syncNaturalSize());
  });

  createEffect(() => {
    if (!props.open) return;
    currentSrc();
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNaturalSize({ w: 0, h: 0 });
    setPendingFit(true);
    queueMicrotask(() => syncNaturalSize());
  });

  createEffect(() => {
    if (!props.open || !pendingFit()) return;
    const viewport = viewportSize();
    const natural = naturalSize();
    if (!viewport.w || !viewport.h || !natural.w || !natural.h) return;
    fitToViewport();
    setPendingFit(false);
  });

  const zoomLabel = () => `${Math.round(zoom() * 100)}%`;

  return (
    <Modal
      open={props.open}
      onClose={handleClose}
      contentClass="vn-image-preview-modal"
    >
      <Grid
        gap="0"
        gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 1fr) 300px" }}
        minH={{ base: "auto", lg: "82vh" }}
        maxH="90vh"
        bg="bg.default"
      >
        <Stack gap="3" p={{ base: "3", lg: "4" }} minW="0">
          <HStack justify="space-between" alignItems="flex-start" gap="3" flexWrap="wrap">
            <Stack gap="1">
              <Box fontSize={{ base: "sm", lg: "md" }} fontWeight="semibold" lineClamp="2">
                {props.title || "Image preview"}
              </Box>
              <Box color="fg.muted" fontSize="xs">
                {zoomLabel()}
              </Box>
            </Stack>

            <HStack gap="2" flexWrap="wrap">
              <Show when={canCycle()}>
                <Box
                  px="2"
                  py="1"
                  borderRadius="full"
                  bg="bg.subtle"
                  borderWidth="1px"
                  borderColor="border"
                  fontSize="xs"
                  color="fg.muted"
                >
                  {activeIndex() + 1} / {images().length}
                </Box>
                <Button size="xs" variant="outline" onClick={() => cycleImage(-1)}>
                  Prev
                </Button>
                <Button size="xs" variant="outline" onClick={() => cycleImage(1)}>
                  Next
                </Button>
              </Show>
              <Button size="xs" onClick={handleClose}>
                Close
              </Button>
            </HStack>
          </HStack>

          <Box
            ref={setViewportRef}
            position="relative"
            flex="1"
            minH={{ base: "52vh", lg: "72vh" }}
            bg="gray.surface.bg"
            borderWidth="1px"
            borderColor="gray.outline.border"
            borderRadius="l3"
            overflow="hidden"
            onWheel={(e) => handleWheel(e)}
            onPointerDown={(e) => handlePointerDown(e)}
            onPointerMove={(e) => handlePointerMove(e)}
            onPointerUp={(e) => handlePointerUp(e)}
            onPointerCancel={(e) => handlePointerUp(e)}
            style={{
              cursor: dragging() ? "grabbing" : "grab",
              "touch-action": "none",
              background:
                "radial-gradient(circle at top, rgba(255,255,255,0.18), transparent 42%), linear-gradient(180deg, rgba(20,24,34,0.92), rgba(12,14,22,0.98))",
            }}
          >
            <Show when={currentSrc()}>
              <img
                ref={(el) => {
                  imageEl = el;
                }}
                src={currentSrc()}
                alt={props.alt ?? ""}
                title={props.title}
                draggable={false}
                onLoad={handleImageLoad}
                style={{
                  position: "absolute",
                  left: "0",
                  top: "0",
                  transform: `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})`,
                  "transform-origin": "0 0",
                  "max-width": "none",
                  "max-height": "none",
                  "user-select": "none",
                  "pointer-events": "none",
                  "box-shadow": "0 28px 80px rgba(0, 0, 0, 0.42)",
                }}
              />
            </Show>
          </Box>
        </Stack>

        <Stack
          gap="4"
          p={{ base: "3", lg: "4" }}
          borderLeftWidth={{ base: "0", lg: "1px" }}
          borderTopWidth={{ base: "1px", lg: "0" }}
          borderColor="border"
          bg={{ base: "bg.default", lg: "bg.subtle" }}
          minH="0"
        >
          <Stack gap="2">
            <Box fontSize="sm" fontWeight="semibold">
              Controls
            </Box>
            <Grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="2">
              <Button size="sm" variant="outline" onClick={handleZoomOut}>
                Zoom -
              </Button>
              <Button size="sm" variant="outline" onClick={handleZoomIn}>
                Zoom +
              </Button>
              <Button size="sm" variant="outline" onClick={handleZoomReset}>
                100%
              </Button>
              <Button size="sm" variant="outline" onClick={handleZoomFit}>
                Fit
              </Button>
              <Button size="sm" variant="outline" onClick={() => void handleCopy()}>
                Copy
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownload}>
                Download
              </Button>
            </Grid>
          </Stack>

          <Show when={canCycle()}>
            <Stack gap="2" flex="1" minH="0">
              <HStack justify="space-between" alignItems="center" gap="2">
                <Box fontSize="sm" fontWeight="semibold">
                  Images
                </Box>
                <Box fontSize="xs" color="fg.muted">
                  Click to switch
                </Box>
              </HStack>

              <Stack
                gap="2"
                flex="1"
                minH="0"
                overflowY="auto"
                pr="1"
                overscrollBehavior="contain"
              >
                <For each={images()}>
                  {(src, index) => (
                    <Button
                      type="button"
                      variant="plain"
                      p="0"
                      h="88px"
                      w="full"
                      justifyContent="flex-start"
                      borderRadius="l3"
                      borderWidth="2px"
                      borderColor={index() === activeIndex() ? "border.accent" : "border"}
                      bg={index() === activeIndex() ? "bg.default" : "bg.subtle"}
                      overflow="hidden"
                      boxShadow={index() === activeIndex() ? "md" : "sm"}
                      onClick={() => setActiveIndex(index())}
                    >
                      <HStack gap="0" w="full" h="full" alignItems="stretch">
                        <Box w="96px" h="full" flexShrink="0" overflow="hidden">
                          <img
                            src={src}
                            alt={`Preview image ${index() + 1}`}
                            style={{
                              width: "100%",
                              height: "100%",
                              "object-fit": "cover",
                              display: "block",
                            }}
                          />
                        </Box>
                        <Stack
                          gap="1"
                          justify="center"
                          alignItems="flex-start"
                          p="3"
                          minW="0"
                          flex="1"
                        >
                          <Box fontSize="sm" fontWeight="medium">
                            Image {index() + 1}
                          </Box>
                          <Box fontSize="xs" color="fg.muted">
                            {index() === activeIndex() ? "Currently selected" : "Open this image"}
                          </Box>
                        </Stack>
                      </HStack>
                    </Button>
                  )}
                </For>
              </Stack>
            </Stack>
          </Show>
        </Stack>
      </Grid>
    </Modal>
  );
};
