import {
  For,
  createMemo,
  untrack,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { colorFor } from "~/utils/colors";
import type { DocItem } from "~/types/notes";
import type { NoteLabelLayout } from "../labels/note-label-layout";

type NoteLabelProps = {
  layout: NoteLabelLayout;
  doc: Accessor<DocItem | undefined>;
  isHovered: Accessor<boolean>;
  zoomScale: Accessor<number>;
  fontSize: Accessor<number>;
  noteOpacity: Accessor<number>;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  suppressNextOpen?: () => void;
  onSelect: () => void;
};

/** A note title bubble with a straight leader back to its dot. */
export const NoteLabel: VoidComponent<NoteLabelProps> = (props) => {
  const layout = () => props.layout;
  const zoomScale = () => props.zoomScale();
  const clipId = () => `note-label-clip-${layout().docId}`;
  const accentColor = createMemo(() =>
    colorFor(props.doc()?.path || props.doc()?.title || layout().docId),
  );
  const bubbleStroke = createMemo(() =>
    props.isHovered() ? "rgba(37, 99, 235, 0.3)" : "rgba(148, 163, 184, 0.28)",
  );
  const leaderStroke = createMemo(() =>
    props.isHovered() ? "rgba(37, 99, 235, 0.5)" : "rgba(100, 116, 139, 0.42)",
  );
  const originX = () => layout().minX;
  const originY = () => layout().minY;
  // Bubble geometry keeps the zoom it was laid out at; layouts are rebuilt
  // on every zoom change, so only a frozen hover label ever goes stale.
  const mountZoom = untrack(() => props.zoomScale());
  const hitPadX = () => 5 / mountZoom;
  const hitPadY = () => 4 / mountZoom;
  const bubbleWidth = () => layout().maxX - layout().minX;
  const bubbleHeight = () => layout().maxY - layout().minY;
  const bubbleRadius = () => 2.5 / mountZoom;
  const textInsetX = () => 4 / mountZoom;
  const renderedTextX = () =>
    layout().textAnchor === "start"
      ? layout().textX - originX() + textInsetX()
      : layout().textAnchor === "end"
        ? layout().textX - originX() - textInsetX()
        : layout().textX - originX();
  return (
    <g
      style={{
        "pointer-events": "none",
        transform: `translate(${originX()}px, ${originY()}px)`,
        "transform-origin": "0 0",
        cursor: "pointer",
      }}
    >
      <defs>
        <clipPath id={clipId()}>
          <rect
            x={0.5 / zoomScale()}
            y={0.5 / zoomScale()}
            width={Math.max(0, bubbleWidth() - 1 / zoomScale())}
            height={Math.max(0, bubbleHeight() - 1 / zoomScale())}
            rx={bubbleRadius()}
            ry={bubbleRadius()}
          />
        </clipPath>
      </defs>
      <rect
        x={-hitPadX()}
        y={-hitPadY()}
        width={bubbleWidth() + hitPadX() * 2}
        height={bubbleHeight() + hitPadY() * 2}
        rx={bubbleRadius() + 1 / zoomScale()}
        ry={bubbleRadius() + 1 / zoomScale()}
        fill="rgba(255,255,255,0.001)"
        stroke="transparent"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
        style={{
          cursor: "pointer",
          "pointer-events": props.noteOpacity() > 0.08 ? "auto" : "none",
        }}
        onPointerEnter={() => props.onPointerEnter()}
        onPointerLeave={() => props.onPointerLeave()}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          props.suppressNextOpen?.();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          props.onSelect();
        }}
      />
      <rect
        x={0}
        y={0}
        width={bubbleWidth()}
        height={bubbleHeight()}
        rx={bubbleRadius()}
        ry={bubbleRadius()}
        fill="rgba(255,255,255,0.94)"
        stroke={bubbleStroke()}
        stroke-width={props.isHovered() ? "1" : "0.85"}
        vector-effect="non-scaling-stroke"
        style={{ "pointer-events": "none" }}
      />
      <text
        x={renderedTextX()}
        y={layout().textY - originY()}
        clip-path={`url(#${clipId()})`}
        fill={props.isHovered() ? accentColor() : "rgba(15, 23, 42, 0.92)"}
        font-size={String(props.fontSize())}
        font-weight={props.isHovered() ? "700" : "600"}
        text-anchor={layout().textAnchor}
        text-rendering="geometricPrecision"
        lengthAdjust="spacingAndGlyphs"
        style={{ "pointer-events": "none" }}
      >
        <For each={layout().lines}>
          {(line, lineIndex) => (
            <tspan
              x={renderedTextX()}
              dy={lineIndex() === 0 ? "0" : `${props.fontSize() * 0.95}`}
            >
              {line}
            </tspan>
          )}
        </For>
      </text>
      <path
        d={`M ${layout().leaderStartX - originX()} ${layout().leaderStartY - originY()} L ${layout().leaderEndX - originX()} ${layout().leaderEndY - originY()}`}
        fill="none"
        stroke={leaderStroke()}
        stroke-width={props.isHovered() ? "1.4" : "1.1"}
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
        style={{ "pointer-events": "none" }}
      />
    </g>
  );
};
