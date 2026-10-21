import { For, Show, type Accessor, type VoidComponent } from "solid-js";
import type { RegionLabelLayout } from "../labels/region-label-geometry";
import type { RegionInteraction } from "./region-interaction";

type RegionLabelProps = {
  regionId: string;
  layout: Accessor<RegionLabelLayout>;
  /** Debounced zoom the label text is drawn at. */
  displayZoom: Accessor<number>;
  labelOpacity: Accessor<number>;
  interaction: RegionInteraction;
};

const PAD_X = 6;
const PAD_Y = 4;

/**
 * One region label: text with a halo, an optional elbow leader to the
 * circle edge, and a transparent hit box. Drawn in screen pixels and scaled
 * back by the display zoom so text size stays constant.
 */
export const RegionLabel: VoidComponent<RegionLabelProps> = (props) => {
  const isHovered = () =>
    props.interaction.hoveredRegionId() === props.regionId;
  const isSelected = () =>
    props.interaction.selectedRegionId() === props.regionId;
  const toLocalX = (value: number) =>
    (value - props.layout().minX) * props.displayZoom();
  const toLocalY = (value: number) =>
    (value - props.layout().minY) * props.displayZoom();
  const onPointerDown = () => {
    props.interaction.onPressedRegionChange(props.regionId);
    props.interaction.suppressNextOpen?.();
  };
  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    props.interaction.onZoomToRegion?.(props.regionId);
  };

  return (
    <g
      opacity={
        isSelected()
          ? 1
          : isHovered()
            ? Math.max(0.95, props.labelOpacity())
            : props.labelOpacity()
      }
      style={{
        cursor: "pointer",
        "pointer-events": props.interaction.isRegionHoverBlocked(props.regionId)
          ? "none"
          : "auto",
        transform: `translate(${props.layout().minX}px, ${props.layout().minY}px) scale(${1 / props.displayZoom()})`,
        "transform-origin": "0 0",
      }}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <rect
        x={-PAD_X}
        y={-PAD_Y}
        width={
          (props.layout().maxX - props.layout().minX) * props.displayZoom() +
          PAD_X * 2
        }
        height={
          (props.layout().maxY - props.layout().minY) * props.displayZoom() +
          PAD_Y * 2
        }
        rx={8}
        ry={8}
        fill="transparent"
        onPointerDown={onPointerDown}
        onClick={onClick}
      />
      <Show when={props.layout().showLeader}>
        <path
          d={`M ${toLocalX(props.layout().edgeX)} ${toLocalY(props.layout().edgeY)} L ${toLocalX(props.layout().elbowX)} ${toLocalY(props.layout().elbowY)} L ${toLocalX(props.layout().leaderEndX)} ${toLocalY(props.layout().leaderEndY)}`}
          fill="none"
          stroke={
            isSelected()
              ? "rgba(30, 64, 175, 0.72)"
              : isHovered()
                ? "rgba(30, 64, 175, 0.5)"
                : "rgba(37, 99, 235, 0.3)"
          }
          stroke-width={isSelected() ? "1.9" : isHovered() ? "1.6" : "1.25"}
          vector-effect="non-scaling-stroke"
          onPointerDown={onPointerDown}
          onClick={onClick}
        />
      </Show>
      <text
        x={toLocalX(props.layout().textX)}
        y={toLocalY(props.layout().textY)}
        fill={isSelected() || isHovered() ? "#0f172a" : "#172554"}
        font-size="16"
        font-weight="700"
        text-anchor={props.layout().textAnchor}
        paint-order="stroke"
        stroke={
          isSelected()
            ? "rgba(219, 234, 254, 0.98)"
            : isHovered()
              ? "rgba(255, 237, 213, 0.98)"
              : "rgba(255,255,255,0.88)"
        }
        stroke-width={String(isSelected() ? 7 : isHovered() ? 6 : 4)}
        stroke-linejoin="round"
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        <For each={props.layout().lines}>
          {(line, lineIndex) => (
            <tspan
              x={toLocalX(props.layout().textX)}
              dy={lineIndex() === 0 ? "0" : "15.2"}
              onPointerDown={onPointerDown}
              onClick={onClick}
            >
              {line}
            </tspan>
          )}
        </For>
      </text>
    </g>
  );
};
