import { For, type Accessor, type VoidComponent } from "solid-js";
import {
  REGION_LABEL_FONT_PX,
  REGION_LABEL_LINE_PX,
  type RegionLabelLayout,
} from "../labels/region-label-plan";
import type { RegionInteraction } from "./region-interaction";

type RegionLabelProps = {
  layout: Accessor<RegionLabelLayout>;
  /** Live zoom: the label keeps its screen size at any zoom. */
  zoom: Accessor<number>;
  /** Whether the label is in the shown set; changes cross-fade. */
  shown: Accessor<boolean>;
  /**
   * Whether the label takes pointers. A label shown only because its region
   * is hovered stays read-only, so it can never cover and steal a press
   * meant for the shape beneath it.
   */
  clickable: Accessor<boolean>;
  labelOpacity: Accessor<number>;
  interaction: RegionInteraction;
};

const PAD_X = 6;
const PAD_Y = 4;
/** Baseline of the first line below the top of the text block. */
const FIRST_BASELINE_PX = 15;

/**
 * One region label: centered text with a halo and a transparent hit box.
 * It translates to its world anchor and scales by 1 / zoom, so position and
 * size update together in the same frame.
 */
export const RegionLabel: VoidComponent<RegionLabelProps> = (props) => {
  const regionId = () => props.layout().regionId;
  const isHovered = () => props.interaction.hoveredRegionId() === regionId();
  const isSelected = () => props.interaction.selectedRegionId() === regionId();
  const box = () => props.layout().box;
  const onPointerDown = () => {
    props.interaction.onPressedRegionChange(regionId());
    props.interaction.suppressNextOpen?.();
  };
  const interactive = () =>
    props.shown() &&
    props.clickable() &&
    !props.interaction.isRegionHoverBlocked(regionId());

  return (
    <g
      transform={`translate(${props.layout().anchorX} ${props.layout().anchorY}) scale(${1 / props.zoom()})`}
      opacity={
        isSelected()
          ? 1
          : isHovered()
            ? Math.max(0.95, props.labelOpacity())
            : props.labelOpacity()
      }
    >
      <g
        data-region-label={regionId()}
        style={{
          opacity: props.shown() ? 1 : 0,
          transition: "opacity 180ms ease-out",
          cursor: "pointer",
          "pointer-events": interactive() ? "auto" : "none",
        }}
        onPointerDown={onPointerDown}
        onPointerEnter={() => {
          if (!interactive()) return;
          props.interaction.onHoveredRegionChange(regionId());
        }}
        onPointerLeave={() => {
          if (!interactive()) return;
          props.interaction.onHoveredRegionChange(undefined);
        }}
      >
        <rect
          x={box().left - PAD_X}
          y={box().top - PAD_Y}
          width={box().width + PAD_X * 2}
          height={box().height + PAD_Y * 2}
          rx={8}
          ry={8}
          fill="transparent"
        />
        <text
          x={0}
          y={box().top + FIRST_BASELINE_PX}
          fill={isSelected() || isHovered() ? "#0f172a" : "#172554"}
          font-size={String(REGION_LABEL_FONT_PX)}
          font-weight="700"
          text-anchor="middle"
          paint-order="stroke"
          stroke={
            isSelected()
              ? "rgba(255, 255, 255, 0.98)"
              : isHovered()
                ? "rgba(255, 255, 255, 0.96)"
                : "rgba(255, 255, 255, 0.88)"
          }
          stroke-width={String(isSelected() || isHovered() ? 6 : 4)}
          stroke-linejoin="round"
        >
          <For each={props.layout().lines}>
            {(line, lineIndex) => (
              <tspan
                x={0}
                dy={lineIndex() === 0 ? "0" : String(REGION_LABEL_LINE_PX)}
              >
                {line}
              </tspan>
            )}
          </For>
        </text>
      </g>
    </g>
  );
};
