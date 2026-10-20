import { CalendarDaysIcon, KanbanIcon, LayoutGridIcon, TableIcon } from "lucide-solid";
import { For } from "solid-js";
import { Dynamic } from "solid-js/web";
import { css } from "styled-system/css";
import type { ViewType } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";

export const VIEW_ICONS: Record<ViewType, typeof TableIcon> = {
  table: TableIcon,
  board: KanbanIcon,
  gallery: LayoutGridIcon,
  calendar: CalendarDaysIcon,
};

const bar = css({ display: "flex", alignItems: "center", gap: "1", flexWrap: "wrap", minH: "8" });
const tab = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  h: "8",
  px: "2.5",
  borderRadius: "l2",
  fontSize: "sm",
  color: "fg.muted",
  cursor: "pointer",
  _hover: { bg: "bg.muted", color: "fg.default" },
  "&[aria-selected=true]": { color: "fg.default", fontWeight: "medium", bg: "bg.muted" },
});

/** Tabs for a collection's saved views. */
export const ViewTabs = (props: { activeViewId?: string; onSelect: (viewId: string) => void }) => {
  const { store } = useCollection();
  return (
    <div class={bar} role="tablist" aria-label="Views">
      <For each={store.state.views}>
        {(view) => (
          <button
            type="button"
            role="tab"
            class={tab}
            aria-selected={view.id === props.activeViewId}
            onClick={() => props.onSelect(view.id)}
          >
            <Dynamic component={VIEW_ICONS[view.type]} size={14} />
            {view.name}
          </button>
        )}
      </For>
    </div>
  );
};
