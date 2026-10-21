import { For, Show, type Accessor, type VoidComponent } from "solid-js";
import type { UmapRegionItem } from "~/features/umap/region-types";
import type { RegionLabelLayout } from "../labels/region-label-geometry";
import { RegionLabel } from "./RegionLabel";
import type { RegionInteraction } from "./region-interaction";

type RegionLabelLayerProps = {
  regions: Accessor<UmapRegionItem[]>;
  labeledRegionIds: Accessor<Set<string>>;
  layoutById: Accessor<Map<string, RegionLabelLayout>>;
  /** Pinned label for the selected region; overrides `layoutById`. */
  fixedSelectedLayout: Accessor<RegionLabelLayout | null>;
  labelOpacity: Accessor<number>;
  displayZoom: Accessor<number>;
  interaction: RegionInteraction;
};

/**
 * Region labels. The selected and hovered regions always show; others show
 * only when labeled at this zoom and no region is selected.
 */
export const RegionLabelLayer: VoidComponent<RegionLabelLayerProps> = (
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
          <Show
            when={isSelected() || isHovered() || props.labelOpacity() > 0.04}
          >
            <Show
              when={
                isSelected() ||
                isHovered() ||
                (props.interaction.selectedRegionId() == null &&
                  props.labeledRegionIds().has(region.id))
              }
            >
              <Show
                when={
                  (isSelected() && props.fixedSelectedLayout()) ||
                  props.layoutById().get(region.id)
                }
              >
                {(layout) => (
                  <RegionLabel
                    regionId={region.id}
                    layout={layout}
                    displayZoom={props.displayZoom}
                    labelOpacity={props.labelOpacity}
                    interaction={props.interaction}
                  />
                )}
              </Show>
            </Show>
          </Show>
        );
      }}
    </For>
  );
};
