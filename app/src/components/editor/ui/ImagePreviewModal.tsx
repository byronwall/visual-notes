import { Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import type { VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import Modal from "~/components/Modal";

type Point = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export const ImagePreviewModal: VoidComponent<{
  open: boolean;
  src: string;
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
  const [dragging, setDragging] = createSignal(false);

  let viewportEl: HTMLDivElement | undefined;
  let dragStart: { pointer: Point; pan: Point } | null = null;

  const setZoomAround = (next: number, anchor: Point) => {
    const prevZoom = zoom();
    const prevPan = pan();
    const z = clamp(next, 0.1, 8);
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
    const v = viewportSize();
    const n = naturalSize();
    if (!v.w || !v.h || !n.w || !n.h) return;
    const scale = Math.min(v.w / n.w, v.h / n.h) * 0.98;
    const z = clamp(scale, 0.1, 8);
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

  const handleWheel = (e: WheelEvent) => {
    if (!props.open) return;
    if (!viewportEl) return;
    e.preventDefault();
    const rect = viewportEl.getBoundingClientRect();
    const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const direction = e.deltaY > 0 ? -1 : 1;
    const factor = direction > 0 ? 1.1 : 0.9;
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
    setNaturalSize({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
    console.log("[image-preview] loaded:", img.naturalWidth, img.naturalHeight);
    if (!props.open) return;
    queueMicrotask(() => fitToViewport());
  };

  onMount(() => {
    if (!viewportEl) return;
    const updateSize = () => {
      if (!viewportEl) return;
      setViewportSize({
        w: viewportEl.clientWidth || 0,
        h: viewportEl.clientHeight || 0,
      });
    };

    updateSize();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateSize())
        : null;
    ro?.observe(viewportEl);
    onCleanup(() => ro?.disconnect());
  });

  // When opened (or when the src changes while open), fit image to viewport.
  createEffect(() => {
    if (!props.open) return;
    console.log("[image-preview] open:", props.src);
    queueMicrotask(() => fitToViewport());
  });

  const zoomLabel = () => `${Math.round(zoom() * 100)}%`;

  return (
    <Modal
      open={props.open}
      onClose={handleClose}
      contentClass="vn-image-preview-modal"
    >
      <Stack gap="3" p="3">
        <HStack gap="2" alignItems="center" flexWrap="wrap">
          <HStack gap="2" alignItems="center">
            <Button size="xs" variant="outline" onClick={handleZoomOut}>
              Zoom -
            </Button>
            <Button size="xs" variant="outline" onClick={handleZoomIn}>
              Zoom +
            </Button>
            <Button size="xs" variant="outline" onClick={handleZoomReset}>
              100%
            </Button>
            <Button size="xs" variant="outline" onClick={handleZoomFit}>
              Fit
            </Button>
          </HStack>
          <Box ml="auto" fontSize="xs" color="fg.muted">
            {zoomLabel()}
          </Box>
          <Button size="xs" ml="2" onClick={handleClose}>
            Close
          </Button>
        </HStack>

        <Box
          ref={(el) => {
            viewportEl = el;
          }}
          position="relative"
          height="90vh"
          bg="gray.surface.bg"
          borderWidth="1px"
          borderColor="gray.outline.border"
          borderRadius="l2"
          overflow="hidden"
          onWheel={(e) => handleWheel(e)}
          onPointerDown={(e) => handlePointerDown(e)}
          onPointerMove={(e) => handlePointerMove(e)}
          onPointerUp={(e) => handlePointerUp(e)}
          onPointerCancel={(e) => handlePointerUp(e)}
          style={{
            cursor: dragging() ? "grabbing" : "grab",
            "touch-action": "none",
          }}
        >
          <Show when={props.src}>
            <img
              src={props.src}
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
              }}
            />
          </Show>
        </Box>
      </Stack>
    </Modal>
  );
};
