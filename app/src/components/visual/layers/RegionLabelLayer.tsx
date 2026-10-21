import { For, Show, type Accessor, type VoidComponent } from "solid-js";
import type { UmapRegionItem } from "~/features/umap/region-types";
import type { RegionLabelLayout } from "../labels/region-label-plan";
import { RegionLabel } from "./RegionLabel";
import type { RegionInteraction } from "./region-interaction";

type RegionLabelLayerProps = {
  regions: Accessor<UmapRegionItem[]>;
  layouts: Accessor<Map<string, RegionLabelLayout>>;
  labeledRegionIds: Accessor<Set<string>>;
  labelOpacity: Accessor<number>;
  zoom: Accessor<number>;
  interaction: RegionInteraction;
};

/**
 * Region labels. Every region keeps a mounted label so membership changes
 * cross-fade instead of popping. The selected and hovered regions always
 * show; others show when the settled plan labels them and nothing is
 * selected.
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
        const planned = () =>
          isSelected() ||
          (props.interaction.selectedRegionId() == null &&
            props.labeledRegionIds().has(region.id));
        const shown = () => planned() || isHovered();
        return (
          <Show when={props.layouts().get(region.id)}>
            {(layout) => (
              <RegionLabel
                layout={layout}
                zoom={props.zoom}
                shown={shown}
                clickable={planned}
                labelOpacity={props.labelOpacity}
                interaction={props.interaction}
              />
            )}
          </Show>
        );
      }}
    </For>
  );
};
