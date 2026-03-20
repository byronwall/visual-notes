import Image from "@tiptap/extension-image";
import { ExpandIcon, MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-solid";
import { For, createMemo, createSignal, onCleanup, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import {
  createSolidNodeViewRenderer,
  NodeViewWrapper,
  useSolidNodeView,
} from "../nodeviews";
import { openImagePreview } from "../ui/imagePreviewService";

type ImageAttrs = {
  src?: string;
  alt?: string;
  title?: string;
  widthPercent?: number | null;
};

const MIN_WIDTH_PERCENT = 15;
const MAX_WIDTH_PERCENT = 100;
const DEFAULT_WIDTH_PERCENT = 100;
const WIDTH_STEP_PERCENT = 5;
const COMMON_WIDTH_FRACTIONS: ReadonlyArray<[number, number]> = [
  [1, 7],
  [1, 6],
  [1, 5],
  [1, 4],
  [1, 3],
  [2, 5],
  [1, 2],
  [3, 5],
  [2, 3],
  [3, 4],
  [4, 5],
  [1, 1],
];

function clampPercent(value: number) {
  return Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, value));
}

function parseWidthPercent(value: unknown): number {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_WIDTH_PERCENT;
  return clampPercent(Math.round(parsed));
}

const COMMON_WIDTH_PERCENTS = Array.from(
  new Set(
    COMMON_WIDTH_FRACTIONS.map(([numerator, denominator]) =>
      clampPercent(Math.round((numerator / denominator) * 100))
    )
  )
).sort((a, b) => a - b);

const imageNodeClass = css({
  position: "relative",
  marginTop: "3",
  marginBottom: "3",
  maxWidth: "100%",
  minWidth: "0",
});
const imageNodeSelectedClass = css({
  borderRadius: "l2",
  boxShadow: "inset 0 0 0 2px rgba(17, 24, 39, 0.95)",
});

const imageElementClass = css({
  display: "block",
  width: "100%",
  maxWidth: "100%",
  height: "auto",
  borderRadius: "l2",
  userSelect: "none",
});

function CustomImageNodeView() {
  const { state } = useSolidNodeView<ImageAttrs>();
  const [resizing, setResizing] = createSignal(false);
  const selected = createMemo(() => state().selected || resizing());

  const src = createMemo(() => String(state().node.attrs.src || ""));
  const alt = createMemo(() => String(state().node.attrs.alt || ""));
  const title = createMemo(() => {
    const value = state().node.attrs.title;
    return value ? String(value) : undefined;
  });
  const widthPercent = createMemo(() =>
    parseWidthPercent(state().node.attrs.widthPercent)
  );
  const widthOptions = createMemo(() => {
    const current = widthPercent();
    if (COMMON_WIDTH_PERCENTS.includes(current)) return COMMON_WIDTH_PERCENTS;
    return [...COMMON_WIDTH_PERCENTS, current].sort((a, b) => a - b);
  });
  const controlsStyle = createMemo<JSX.CSSProperties>(() => ({
    opacity: selected() ? "1" : "0",
    visibility: selected() ? "visible" : "hidden",
    pointerEvents: selected() ? "auto" : "none",
    transition: "opacity 140ms ease, visibility 140ms ease",
  }));
  const imageStyle = createMemo<JSX.CSSProperties>(() => ({
    width: "100%",
  }));
  const resizeHandleStyle = createMemo<JSX.CSSProperties>(() => ({
    transform: "translateY(-50%)",
    opacity: selected() ? "1" : "0",
    visibility: selected() ? "visible" : "hidden",
    pointerEvents: selected() ? "auto" : "none",
    transition: "opacity 120ms ease, visibility 120ms ease",
  }));

  let rootEl: HTMLDivElement | undefined;
  let imageEl: HTMLImageElement | undefined;
  let activeCleanup: (() => void) | undefined;

  const clearResizeSession = () => {
    if (!activeCleanup) return;
    activeCleanup();
    activeCleanup = undefined;
    setResizing(false);
  };

  const selectImageNode = () => {
    const pos = state().getPos();
    if (typeof pos !== "number") return;
    state().editor.chain().focus().setNodeSelection(pos).run();
  };

  const onClick = (event: MouseEvent) => {
    if (event.button !== 0) return;
    selectImageNode();
  };

  const onDblClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-image-action='true']")) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    selectImageNode();
    event.preventDefault();
    event.stopPropagation();
    openImagePreview({ src: src(), alt: alt(), title: title() });
  };

  const applyWidth = (nextPercent: number) => {
    const clamped = clampPercent(Math.round(nextPercent));
    const current = widthPercent();
    if (clamped === current) return;
    try {
      const pos = state().getPos();
      if (typeof pos !== "number") return;
      const transaction = state().view.state.tr.setNodeMarkup(pos, undefined, {
        ...state().node.attrs,
        widthPercent: clamped,
      });
      state().view.dispatch(transaction);
    } catch {}
  };

  const resetWidth = () => {
    applyWidth(DEFAULT_WIDTH_PERCENT);
  };

  const onResizePointerDown = (event: PointerEvent, side: "left" | "right") => {
    const handleEl = event.currentTarget as HTMLElement | null;
    if (event.button !== 0) return;
    if (!rootEl || !imageEl) return;
    event.preventDefault();
    event.stopPropagation();
    handleEl?.setPointerCapture(event.pointerId);
    selectImageNode();
    setResizing(true);

    const host =
      (rootEl.closest(".ProseMirror") as HTMLElement | null) || rootEl.parentElement;
    if (!host) {
      setResizing(false);
      return;
    }

    const hostWidth = host.getBoundingClientRect().width;
    const startWidth = imageEl.getBoundingClientRect().width;
    if (hostWidth <= 0 || startWidth <= 0) {
      setResizing(false);
      return;
    }

    const startX = event.clientX;
    const direction = side === "right" ? 1 : -1;

    const onMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const deltaX = (moveEvent.clientX - startX) * direction;
      const nextWidth = startWidth + deltaX;
      const nextPercent = (nextWidth / hostWidth) * 100;
      applyWidth(nextPercent);
    };

    const onUp = () => {
      if (handleEl?.hasPointerCapture(event.pointerId)) {
        handleEl.releasePointerCapture(event.pointerId);
      }
      clearResizeSession();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    activeCleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  };

  onCleanup(() => {
    clearResizeSession();
  });

  return (
    <NodeViewWrapper
      as="div"
      class={`${imageNodeClass} ${selected() ? imageNodeSelectedClass : ""} vn-image-node`}
      data-selected={state().selected ? "true" : "false"}
      data-resizing={resizing() ? "true" : "false"}
      style={{ width: `${widthPercent()}%` }}
      onClick={onClick}
      onDblClick={onDblClick}
      data-node-view-image="true"
      ref={(el) => {
        rootEl = el as HTMLDivElement;
      }}
    >
      <Box
        as="span"
        class="vn-image-controls"
        data-image-action="true"
        contentEditable={false}
        position="absolute"
        top="0"
        right="2"
        zIndex="2"
        display="inline-flex"
        bg="bg.default"
        borderWidth="1px"
        borderColor="gray.outline.border"
        borderRadius="l2"
        px="2"
        py="1"
        boxShadow="sm"
        style={{
          transform: "translateY(-70%)",
          ...controlsStyle(),
        }}
        onDblClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <HStack gap="1">
          <IconButton
            size="xs"
            variant="plain"
            colorPalette="gray"
            aria-label="Zoom out image"
            title="Zoom out image"
            data-image-action="true"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              selectImageNode();
            }}
            onClick={() => applyWidth(widthPercent() - WIDTH_STEP_PERCENT)}
          >
            <MinusIcon size={12} />
          </IconButton>
          <select
            value={String(widthPercent())}
            class={css({
              appearance: "none",
              borderWidth: "0",
              outlineWidth: "0",
              bg: "transparent",
              color: "fg.muted",
              fontSize: "xs",
              lineHeight: "1",
              minW: "10",
              textAlign: "center",
              px: "1.5",
              py: "1",
              borderRadius: "l1",
              cursor: "pointer",
              _focusVisible: {
                outlineWidth: "1px",
                outlineStyle: "solid",
                outlineColor: "blue.8",
              },
            })}
            aria-label="Set image width"
            title="Set image width"
            data-image-action="true"
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
            onChange={(event) => {
              const next = Number.parseInt(event.currentTarget.value, 10);
              if (!Number.isFinite(next)) return;
              applyWidth(next);
            }}
          >
            <For each={widthOptions()}>
              {(optionPercent) => (
                <option value={String(optionPercent)}>{optionPercent}%</option>
              )}
            </For>
          </select>
          <IconButton
            size="xs"
            variant="plain"
            colorPalette="gray"
            aria-label="Zoom in image"
            title="Zoom in image"
            data-image-action="true"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              selectImageNode();
            }}
            onClick={() => applyWidth(widthPercent() + WIDTH_STEP_PERCENT)}
          >
            <PlusIcon size={12} />
          </IconButton>
          <IconButton
            size="xs"
            variant="plain"
            colorPalette="gray"
            aria-label="Reset image size to 100%"
            title="Reset image size to 100%"
            data-image-action="true"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              selectImageNode();
            }}
            onClick={resetWidth}
          >
            <RotateCcwIcon size={12} />
          </IconButton>
          <IconButton
            size="xs"
            variant="plain"
            colorPalette="gray"
            aria-label="Expand image"
            title="Expand image"
            data-image-action="true"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              selectImageNode();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openImagePreview({ src: src(), alt: alt(), title: title() });
            }}
          >
            <ExpandIcon size={12} />
          </IconButton>
        </HStack>
      </Box>

      <img
        ref={(el) => {
          imageEl = el;
        }}
        class={`${imageElementClass} vn-image`}
        draggable={false}
        src={src()}
        alt={alt()}
        title={title()}
        style={imageStyle()}
      />

      <Box
        as="span"
        class="vn-image-resize-handle vn-image-resize-handle-left"
        data-image-action="true"
        contentEditable={false}
        position="absolute"
        top="50%"
        left="-9px"
        width="16px"
        height="36px"
        borderWidth="1px"
        borderStyle="solid"
        borderColor="gray.outline.border"
        borderRadius="full"
        bg="bg.default"
        boxShadow="sm"
        cursor="ew-resize"
        style={resizeHandleStyle()}
        onPointerDown={(event) => onResizePointerDown(event, "left")}
      />
      <Box
        as="span"
        class="vn-image-resize-handle vn-image-resize-handle-right"
        data-image-action="true"
        contentEditable={false}
        position="absolute"
        top="50%"
        right="-9px"
        width="16px"
        height="36px"
        borderWidth="1px"
        borderStyle="solid"
        borderColor="gray.outline.border"
        borderRadius="full"
        bg="bg.default"
        boxShadow="sm"
        cursor="ew-resize"
        style={resizeHandleStyle()}
        onPointerDown={(event) => onResizePointerDown(event, "right")}
      />
    </NodeViewWrapper>
  );
}

export const CustomImage = Image.extend({
  addAttributes() {
    // TODO:AS_ANY, extend base attrs; parent() is not well-typed in Tiptap's API
    const parent = (this as any).parent?.() ?? {};
    return {
      ...parent,
      widthPercent: {
        default: DEFAULT_WIDTH_PERCENT,
        parseHTML: (element: HTMLElement) => {
          const fromData = element.getAttribute("data-width");
          if (fromData) return parseWidthPercent(fromData);
          const styleWidth = element.style?.width || "";
          if (styleWidth.endsWith("%")) {
            return parseWidthPercent(styleWidth.slice(0, -1));
          }
          return DEFAULT_WIDTH_PERCENT;
        },
        renderHTML: (attrs: ImageAttrs) => {
          const width = parseWidthPercent(attrs.widthPercent);
          return {
            "data-width": String(width),
            style: `width: ${width}%;`,
          };
        },
      },
    } as any;
  },
  addNodeView() {
    return createSolidNodeViewRenderer(CustomImageNodeView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement | null;
        return !!target?.closest("[data-image-action='true']");
      },
    });
  },
});
