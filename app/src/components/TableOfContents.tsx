import { type VoidComponent, Show } from "solid-js";
import { DEFAULT_MAX_VH } from "./toc/constants";
import { TocExpandedPanel } from "./toc/TocExpandedPanel";
import { TocRail } from "./toc/TocRail";
import { useTocController } from "./toc/useTocController";

export const TableOfContents: VoidComponent<{
  getRootEl: () => HTMLElement | null;
  class?: string;
  maxVh?: number;
}> = (props) => {
  const maxVh = () => props.maxVh ?? DEFAULT_MAX_VH;

  const toc = useTocController({
    getRootEl: props.getRootEl,
    maxVh,
  });

  return (
    <div
      class={props.class}
      style={{
        position: "fixed",
        left: `${toc.panelLeftPx()}px`,
        top: `${toc.containerTopPx()}px`,
        transition: "top 220ms ease",
        "z-index": "30",
        "user-select": "none",
      }}
      onMouseEnter={toc.onRailMouseEnter}
      onMouseLeave={toc.onRailMouseLeave}
    >
      <div
        style={{
          position: "absolute",
          top: "0",
          left: `${toc.panelOffsetPx()}px`,
          opacity: toc.showExpandedPanel() ? "1" : "0",
          transform: toc.showExpandedPanel() ? "translateX(0px)" : "translateX(14px)",
          transition: "transform 220ms ease, opacity 200ms ease",
          "pointer-events": toc.showExpandedPanel() ? "auto" : "none",
        }}
      >
        <TocExpandedPanel
          items={toc.items}
          panelWidthPx={toc.panelWidthPx}
          panelMaxHeightCss={toc.panelMaxHeightCss}
          minHeadingLevel={toc.minHeadingLevel}
          activeIndex={toc.activeIndex}
          visibleStartIndex={toc.visibleStartIndex}
          visibleEndIndex={toc.visibleEndIndex}
          onItemClick={toc.onItemClick}
          onListRef={toc.onListRef}
          onListScrollRef={toc.onListScrollRef}
          onPanelRef={toc.onPanelRef}
          onListReady={toc.onListReady}
        />
      </div>

      <Show when={!toc.showExpandedPanel()}>
        <TocRail
          heightPx={toc.collapsedRailHeightPx}
          visibleTopRatio={() => toc.visibleMarkerBounds().topRatio}
          visibleBottomRatio={() => toc.visibleMarkerBounds().bottomRatio}
          markers={toc.markers}
          activeIndex={toc.activeIndex}
          minHeadingLevel={toc.minHeadingLevel}
          onMarkerClick={(marker) => toc.onItemClick(marker.item)}
        />
      </Show>
    </div>
  );
};

export default TableOfContents;
