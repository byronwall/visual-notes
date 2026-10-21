import { For, Show, type Accessor, type VoidComponent } from "solid-js";
import type { UmapRegionItem } from "~/features/umap/region-types";
import type { RegionTone } from "../regions/region-colors";
import type { RegionShape } from "../regions/region-shape";
import type { RegionInteraction } from "./region-interaction";

type RegionShapeLayerProps = {
  regions: Accessor<UmapRegionItem[]>;
  shapes: Accessor<Map<string, RegionShape>>;
  tones: Accessor<Map<string, RegionTone>>;
  regionOpacity: Accessor<number>;
  /** A hovered note dot wins clicks over the region shape under it. */
  dotHoveredId: Accessor<string | undefined>;
  interaction: RegionInteraction;
};

/**
 * One soft filled shape per region. Each shape is its region's click
 * target: a press marks the region, and the pan/zoom release (which owns
 * pointer capture) zooms to it. Dots are painted on a canvas above and
 * never take pointers, so at overview the shape always gets the click.
 */
export const RegionShapeLayer: VoidComponent<RegionShapeLayerProps> = (
  props,
) => {
  return (
    <For each={props.regions()}>
      {(region) => {
        const isSelected = () =>
          props.interaction.selectedRegionId() === region.id;
        const isHovered = () =>
          props.interaction.hoveredRegionId() === region.id;
        const blocked = () => props.interaction.isRegionHoverBlocked(region.id);
        return (
          <Show when={props.shapes().get(region.id)}>
            {(shape) => {
              const tone = () => props.tones().get(region.id);
              return (
                <path
                  d={shape().path}
                  data-region-id={region.id}
                  fill={tone()?.fill ?? "hsl(214 70% 55%)"}
                  stroke={tone()?.stroke ?? "hsl(214 45% 42%)"}
                  stroke-width={isSelected() ? 2 : isHovered() ? 1.75 : 1}
                  stroke-linejoin="round"
                  vector-effect="non-scaling-stroke"
                  opacity={
                    isSelected()
                      ? Math.max(0.6, props.regionOpacity())
                      : isHovered()
                        ? Math.max(0.45, props.regionOpacity())
                        : props.regionOpacity()
                  }
                  style={{
                    "fill-opacity": isSelected()
                      ? 0.12
                      : isHovered()
                        ? 0.2
                        : 0.1,
                    "stroke-opacity": isSelected()
                      ? 0.8
                      : isHovered()
                        ? 0.65
                        : 0.3,
                    transition:
                      "fill-opacity 140ms ease, stroke-opacity 140ms ease",
                    cursor: "pointer",
                    "pointer-events": blocked() ? "none" : "auto",
                  }}
                  onPointerEnter={() => {
                    if (blocked()) return;
                    props.interaction.onHoveredRegionChange(region.id);
                  }}
                  onPointerLeave={() => {
                    if (blocked()) return;
                    props.interaction.onHoveredRegionChange(undefined);
                  }}
                  onPointerDown={() => {
                    if (blocked()) return;
                    // Once notes are interactive, a hovered note opens
                    // instead of its region.
                    if (props.dotHoveredId()) return;
                    props.interaction.onHoveredRegionChange(region.id);
                    props.interaction.onPressedRegionChange(region.id);
                    props.interaction.suppressNextOpen?.();
                  }}
                />
              );
            }}
          </Show>
        );
      }}
    </For>
  );
};
