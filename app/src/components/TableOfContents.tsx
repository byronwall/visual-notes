import { type VoidComponent, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { useMobileAppBar } from "./sidebar/mobile-app-bar";
import { PINNED_BOTTOM_GAP } from "./toc/constants";
import { TocFlyout } from "./toc/TocFlyout";
import { TocMobileSheet } from "./toc/TocMobileSheet";
import { TocOutline } from "./toc/TocOutline";
import { useTocController } from "./toc/useTocController";

// A fixed outline would sit on top of the text at phone width; phones get
// the contents sheet in the app bar instead.
const desktopClass = css({ display: { base: "none", md: "flex" } });

export const TableOfContents: VoidComponent<{
  getRootEl: () => HTMLElement | null;
}> = (props) => {
  const toc = useTocController({ getRootEl: () => props.getRootEl() });
  const appBar = useMobileAppBar();

  return (
    <Show when={toc.hasItems()}>
      <Show when={appBar.actionsSlot()}>
        {(slot) => (
          <Portal
            mount={slot()}
            ref={(element) => (element.style.display = "contents")}
          >
            <TocMobileSheet toc={toc} />
          </Portal>
        )}
      </Show>
      <div class={desktopClass}>
        <Show
          when={toc.layout().mode === "pinned"}
          fallback={<TocFlyout toc={toc} />}
        >
          <TocOutline
            toc={toc}
            class={css({ position: "fixed", zIndex: "20" })}
            style={{
              left: `${toc.layout().leftPx}px`,
              top: `${toc.pinnedTopPx()}px`,
              width: `${toc.layout().widthPx}px`,
              "max-height": `calc(100vh - ${toc.pinnedTopPx() + PINNED_BOTTOM_GAP}px)`,
            }}
          />
        </Show>
      </div>
    </Show>
  );
};

export default TableOfContents;
