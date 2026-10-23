import { For, createMemo, type Accessor, type VoidComponent } from "solid-js";
import { colorFor } from "~/utils/colors";
import type { DocItem } from "~/types/notes";
import type { NoteLabelLayout } from "../labels/note-label-layout";

type NoteLabelProps = {
  layout: NoteLabelLayout;
  doc: Accessor<DocItem | undefined>;
  isHovered: Accessor<boolean>;
  /** Zoom the layout was placed at; geometry is in world units at it. */
  layoutZoom: number;
  /** Live zoom: the bubble scales about its note to keep its screen size. */
  liveZoom: Accessor<number>;
  /** Cross-fade state; hidden labels ignore pointers. */
  visible: Accessor<boolean>;
  noteOpacity: Accessor<number>;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  suppressNextOpen?: () => void;
  onSelect: () => void;
};

/**
 * A note title bubble with a straight leader back to its dot. Laid out once
 * at `layoutZoom`; between re-plans it scales about its dot by
 * layoutZoom / liveZoom, so position and size update in the same frame.
 */
export const NoteLabel: VoidComponent<NoteLabelProps> = (props) => {
  const layout = () => props.layout;
  const zoomScale = () => props.layoutZoom;
  const fontSize = () => 12.5 / props.layoutZoom;
  const clipId = () => `note-label-clip-${layout().docId}`;
  const accentColor = createMemo(() =>
    colorFor(props.doc()?.path || props.doc()?.title || layout().docId),
  );
  const bubbleStroke = createMemo(() =>
    props.isHovered() ? "var(--colors-blue-a6)" : "rgba(148, 163, 184, 0.28)",
  );
  const leaderStroke = createMemo(() =>
    props.isHovered() ? "var(--colors-blue-a8)" : "rgba(100, 116, 139, 0.42)",
  );
  const originX = () => layout().minX;
  const originY = () => layout().minY;
  const hitPadX = () => 5 / zoomScale();
  const hitPadY = () => 4 / zoomScale();
  const bubbleWidth = () => layout().maxX - layout().minX;
  const bubbleHeight = () => layout().maxY - layout().minY;
  const bubbleRadius = () => 2.5 / zoomScale();
  const textInsetX = () => 4 / zoomScale();
  const renderedTextX = () =>
    layout().textAnchor === "start"
      ? layout().textX - originX() + textInsetX()
      : layout().textAnchor === "end"
        ? layout().textX - originX() - textInsetX()
        : layout().textX - originX();
  const dotX = () => layout().leaderStartX;
  const dotY = () => layout().leaderStartY;
  const ratio = () => props.layoutZoom / props.liveZoom();
  return (
    <g
      transform={`translate(${dotX()} ${dotY()}) scale(${ratio()}) translate(${-dotX()} ${-dotY()})`}
      style={{
        opacity: props.visible() ? 1 : 0,
        transition: "opacity 180ms ease-out",
      }}
    >
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
            "pointer-events":
              props.visible() && props.noteOpacity() > 0.08 ? "auto" : "none",
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
          font-size={String(fontSize())}
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
                dy={lineIndex() === 0 ? "0" : `${fontSize() * 0.95}`}
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
    </g>
  );
};
