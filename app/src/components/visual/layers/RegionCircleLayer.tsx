import { For, type Accessor, type VoidComponent } from "solid-js";
import type { UmapRegionItem } from "~/features/umap/region-types";
import type { RegionInteraction } from "./region-interaction";

type RegionCircleLayerProps = {
  regions: Accessor<UmapRegionItem[]>;
  regionOpacity: Accessor<number>;
  /** A hovered note dot wins clicks over the region circle under it. */
  dotHoveredId: Accessor<string | undefined>;
  interaction: RegionInteraction;
};

export const RegionCircleLayer: VoidComponent<RegionCircleLayerProps> = (
  props,
) => {
  return (
    <For each={props.regions()}>
      {(region) => {
        const isSelected = () =>
          props.interaction.selectedRegionId() === region.id;
        const isHovered = () =>
          props.interaction.hoveredRegionId() === region.id;
        return (
          <circle
            cx={region.centroid.x}
            cy={region.centroid.y}
            r={Math.max(18, region.radius)}
            fill={
              isSelected()
                ? "rgba(37, 99, 235, 0.2)"
                : isHovered()
                  ? "rgba(249, 115, 22, 0.12)"
                  : "rgba(37, 99, 235, 0.06)"
            }
            stroke={
              isSelected()
                ? "rgba(30, 64, 175, 0.9)"
                : isHovered()
                  ? "rgba(234, 88, 12, 0.72)"
                  : "rgba(37, 99, 235, 0.2)"
            }
            stroke-width={isSelected() ? "3" : isHovered() ? "2.5" : "1.5"}
            vector-effect="non-scaling-stroke"
            opacity={
              isSelected()
                ? Math.max(0.55, props.regionOpacity())
                : isHovered()
                  ? Math.max(0.4, props.regionOpacity())
                  : props.regionOpacity()
            }
            style={{
              cursor: "pointer",
              "pointer-events": props.interaction.isRegionHoverBlocked(
                region.id,
              )
                ? "none"
                : "auto",
            }}
            onPointerEnter={() => {
              if (props.interaction.isRegionHoverBlocked(region.id)) return;
              props.interaction.onHoveredRegionChange(region.id);
            }}
            onPointerLeave={() => {
              if (props.interaction.isRegionHoverBlocked(region.id)) return;
              props.interaction.onHoveredRegionChange(undefined);
            }}
            onPointerDown={() => {
              if (props.interaction.isRegionHoverBlocked(region.id)) return;
              // Dots are painted on the canvas below; a
              // hovered note opens instead of its region.
              if (props.dotHoveredId()) return;
              props.interaction.onHoveredRegionChange(region.id);
              props.interaction.onPressedRegionChange(region.id);
              props.interaction.suppressNextOpen?.();
            }}
            onClick={(e) => {
              if (props.interaction.isRegionHoverBlocked(region.id)) return;
              if (props.dotHoveredId()) return;
              e.preventDefault();
              e.stopPropagation();
              props.interaction.onZoomToRegion?.(region.id);
            }}
          />
        );
      }}
    </For>
  );
};
