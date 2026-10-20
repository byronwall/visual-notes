import { type VoidComponent, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { useMobileAppBar } from "./sidebar/mobile-app-bar";
import { DEFAULT_MAX_VH } from "./toc/constants";
import { TocExpandedPanel } from "./toc/TocExpandedPanel";
import { TocMobileSheet } from "./toc/TocMobileSheet";
import { TocRail } from "./toc/TocRail";
import { useTocController } from "./toc/useTocController";

// The fixed rail would sit on top of the text at phone width; phones get the
// contents sheet in the app bar instead.
const desktopRailClass = css({ display: { base: "none", md: "block" } });

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
  const appBar = useMobileAppBar();

  return (
    <Show when={toc.hasItems()}>
      <Show when={appBar.actionsSlot()}>
        {(slot) => (
          <Portal
            mount={slot()}
            ref={(element) => (element.style.display = "contents")}
          >
            <TocMobileSheet
              items={toc.items}
              activeIndex={toc.activeIndex}
              minHeadingLevel={toc.minHeadingLevel}
              onItemClick={toc.onItemClick}
            />
          </Portal>
        )}
      </Show>
      <div
        class={[desktopRailClass, props.class].filter(Boolean).join(" ")}
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
            showExpandedPanel={toc.showExpandedPanel}
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
    </Show>
  );
};

export default TableOfContents;
