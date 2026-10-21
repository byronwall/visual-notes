import type { Accessor } from "solid-js";

/** Region state and callbacks shared by the circle and label layers. */
export type RegionInteraction = {
  selectedRegionId: Accessor<string | undefined>;
  hoveredRegionId: Accessor<string | undefined>;
  isRegionHoverBlocked: (regionId: string) => boolean;
  onHoveredRegionChange: (id: string | undefined) => void;
  onPressedRegionChange: (id: string | undefined) => void;
  suppressNextOpen?: () => void;
  onZoomToRegion?: (id: string) => void;
};
