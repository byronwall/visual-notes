import { ChevronDownIcon, PlusIcon } from "lucide-solid";
import { For, Show, createEffect, createSignal, on } from "solid-js";
import { Dynamic } from "solid-js/web";
import { css } from "styled-system/css";
import { SimplePopover } from "~/components/ui/simple-popover";
import type { ViewType } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import { MenuItem, menuPanel, menuSection } from "../menu/MenuList";
import { fitContent } from "../popover-styles";
import { CompactViewSwitcher } from "./CompactViewSwitcher";
import { useOverflowTabs } from "./useOverflowTabs";
import { VIEW_ICONS, VIEW_LABELS } from "./view-meta";
import { AddViewItems, ViewOptionsButton, optionsBtn } from "./ViewOptions";

export { VIEW_ICONS, VIEW_LABELS } from "./view-meta";

/** Below this container width the strip becomes one compact switcher. */
const NARROW = "@container viewtabs (max-width: 35rem)";

const bar = css({
  containerType: "inline-size",
  containerName: "viewtabs",
  borderBottomWidth: "1px",
  borderColor: "border",
});
const wide = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  h: "9",
  [NARROW]: { display: "none" },
});
const strip = css({
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: "1",
  flex: "1",
  minW: "0",
  h: "full",
  overflow: "hidden",
});
const tab = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  flexShrink: "0",
  maxW: "14rem",
  h: "full",
  px: "2.5",
  fontSize: "sm",
  whiteSpace: "nowrap",
  color: "fg.muted",
  cursor: "pointer",
  borderBottomWidth: "2px",
  borderColor: "transparent",
  transition: "color 140ms, border-color 140ms",
  _hover: { color: "fg.default" },
  "&[aria-selected=true]": {
    color: "fg.default",
    fontWeight: "medium",
    borderColor: "fg.default",
  },
  "& > span": { overflow: "hidden", textOverflow: "ellipsis" },
  "& > svg": { flexShrink: "0" },
  // Measured but not shown; listed in the "more" menu instead.
  "&[data-overflow]": {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
  },
});
const moreBtn = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  flexShrink: "0",
  h: "7",
  px: "2",
  borderRadius: "l2",
  fontSize: "sm",
  whiteSpace: "nowrap",
  color: "fg.muted",
  cursor: "pointer",
  transition: "color 140ms, background-color 140ms",
  _hover: { bg: "bg.muted", color: "fg.default" },
  "&[aria-expanded=true]": { bg: "bg.muted", color: "fg.default" },
  "&[data-overflow]": {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
  },
});
const compact = css({
  display: "none",
  alignItems: "center",
  gap: "1",
  h: "9",
  [NARROW]: { display: "flex" },
});
const listPanel = css({ maxH: "min(70vh, 28rem)", overflowY: "auto" });

/**
 * A collection's saved views on one line. Wide: tabs, with the ones that do
 * not fit in a "more" menu. Narrow: one switcher button. Both keep a "…"
 * button beside the active view for its settings.
 */
export const ViewTabs = (props: {
  activeViewId?: string;
  onSelect: (viewId: string) => void;
}) => {
  const { store } = useCollection();
  const [adding, setAdding] = createSignal(false);
  const [moreOpen, setMoreOpen] = createSignal(false);
  const overflow = useOverflowTabs({
    ids: () => store.state.views.map((v) => v.id),
    activeId: () => props.activeViewId,
  });
  createEffect(
    on(
      () => store.state.views.map((v) => v.name + v.type).join("\n"),
      overflow.remeasure,
      { defer: true },
    ),
  );
  const active = () =>
    store.state.views.find((v) => v.id === props.activeViewId);
  const hiddenViews = () =>
    store.state.views.filter((v) => overflow.isHidden(v.id));

  const add = async (type: ViewType) => {
    setAdding(false);
    const view = await store.addView(VIEW_LABELS[type], type);
    if (view) props.onSelect(view.id);
  };

  return (
    <div class={bar}>
      <div class={wide}>
        <div
          class={strip}
          ref={overflow.listRef}
          role="tablist"
          aria-label="Views"
        >
          <For each={store.state.views}>
            {(view) => {
              const selected = () => view.id === props.activeViewId;
              return (
                <>
                  <button
                    type="button"
                    role="tab"
                    class={tab}
                    ref={overflow.tabRef(view.id)}
                    aria-selected={selected()}
                    data-overflow={overflow.isHidden(view.id) ? "" : undefined}
                    aria-hidden={overflow.isHidden(view.id) || undefined}
                    tabIndex={overflow.isHidden(view.id) ? -1 : 0}
                    title={view.name.length > 24 ? view.name : undefined}
                    onClick={() => props.onSelect(view.id)}
                  >
                    <Dynamic component={VIEW_ICONS[view.type]} size={14} />
                    <span>{view.name}</span>
                  </button>
                  <Show when={selected()}>
                    <span
                      ref={overflow.extraRef}
                      style={{ display: "inline-flex", "flex-shrink": "0" }}
                    >
                      <ViewOptionsButton
                        view={view}
                        onSelect={props.onSelect}
                      />
                    </span>
                  </Show>
                </>
              );
            }}
          </For>
          <SimplePopover
            class={fitContent}
            open={moreOpen()}
            onClose={() => setMoreOpen(false)}
            anchorClass={css({ display: "inline-flex", flexShrink: "0" })}
            anchor={
              <button
                type="button"
                class={moreBtn}
                ref={overflow.moreRef}
                data-more-views=""
                data-overflow={hiddenViews().length ? undefined : ""}
                aria-hidden={!hiddenViews().length || undefined}
                tabIndex={hiddenViews().length ? 0 : -1}
                aria-haspopup="menu"
                aria-expanded={moreOpen()}
                onClick={() => setMoreOpen((v) => !v)}
              >
                {/* Fixed text while hidden so its measured width is stable. */}
                +{hiddenViews().length || 9} more
                <ChevronDownIcon size={12} />
              </button>
            }
          >
            <div class={`${menuPanel} ${listPanel}`}>
              <div class={menuSection}>More views</div>
              <For each={hiddenViews()}>
                {(view) => (
                  <MenuItem
                    icon={
                      <Dynamic component={VIEW_ICONS[view.type]} size={14} />
                    }
                    onClick={() => {
                      props.onSelect(view.id);
                      setMoreOpen(false);
                    }}
                  >
                    {view.name}
                  </MenuItem>
                )}
              </For>
            </div>
          </SimplePopover>
        </div>
        <SimplePopover
          class={fitContent}
          open={adding()}
          onClose={() => setAdding(false)}
          anchor={
            <button
              type="button"
              class={optionsBtn}
              aria-label="Add view"
              title="Add view"
              aria-expanded={adding()}
              onClick={() => setAdding((v) => !v)}
            >
              <PlusIcon size={14} />
            </button>
          }
        >
          <div class={menuPanel}>
            <div class={menuSection}>Add a view</div>
            <AddViewItems onAdd={(type) => void add(type)} />
          </div>
        </SimplePopover>
      </div>
      <div class={compact}>
        <CompactViewSwitcher
          activeViewId={props.activeViewId}
          onSelect={props.onSelect}
          onAdd={(type) => void add(type)}
        />
        <Show when={active()}>
          {(view) => (
            <ViewOptionsButton view={view()} onSelect={props.onSelect} />
          )}
        </Show>
      </div>
    </div>
  );
};
