import {
  CalendarDaysIcon,
  ChevronDownIcon,
  CopyIcon,
  KanbanIcon,
  LayoutGridIcon,
  PlusIcon,
  TableIcon,
  Trash2Icon,
} from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { Dynamic } from "solid-js/web";
import { css } from "styled-system/css";
import { SimplePopover } from "~/components/ui/simple-popover";
import {
  VIEW_TYPES,
  type CollectionView,
  type ViewType,
} from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import {
  MenuItem,
  menuInput,
  menuPanel,
  menuSection,
  menuSeparator,
} from "../menu/MenuList";
import { fitContent } from "../popover-styles";

export const VIEW_ICONS: Record<ViewType, typeof TableIcon> = {
  table: TableIcon,
  board: KanbanIcon,
  gallery: LayoutGridIcon,
  calendar: CalendarDaysIcon,
};
export const VIEW_LABELS: Record<ViewType, string> = {
  table: "Table",
  board: "Board",
  gallery: "Gallery",
  calendar: "Calendar",
};

const bar = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  flexWrap: "wrap",
  minH: "9",
  borderBottomWidth: "1px",
  borderColor: "border",
});
const tab = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  h: "8",
  px: "2.5",
  mb: "-1px",
  fontSize: "sm",
  color: "fg.muted",
  cursor: "pointer",
  borderBottomWidth: "2px",
  borderColor: "transparent",
  _hover: { color: "fg.default" },
  "&[aria-selected=true]": {
    color: "fg.default",
    fontWeight: "medium",
    borderColor: "fg.default",
  },
});
const addBtn = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  h: "7",
  px: "2",
  borderRadius: "l2",
  color: "fg.subtle",
  fontSize: "sm",
  cursor: "pointer",
  _hover: { bg: "bg.muted", color: "fg.default" },
});

/** The menu behind the active tab: rename, change layout, duplicate, delete. */
const ViewMenu = (props: {
  view: CollectionView;
  onDeleted: () => void;
  onDuplicated: (id: string) => void;
  close: () => void;
}) => {
  const { store } = useCollection();
  return (
    <div class={menuPanel} style={{ width: "15rem" }}>
      <input
        class={menuInput}
        value={props.view.name}
        aria-label="View name"
        onChange={(e) =>
          e.currentTarget.value.trim() &&
          void store.renameView(props.view.id, e.currentTarget.value.trim())
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (e.currentTarget.value.trim())
              void store.renameView(
                props.view.id,
                e.currentTarget.value.trim(),
              );
            props.close();
          }
        }}
      />
      <div class={menuSection}>Layout</div>
      <For each={VIEW_TYPES}>
        {(type) => (
          <MenuItem
            icon={<Dynamic component={VIEW_ICONS[type]} size={14} />}
            selected={props.view.type === type}
            trailing={props.view.type === type ? "✓" : undefined}
            onClick={() => void store.setViewType(props.view.id, type)}
          >
            {VIEW_LABELS[type]}
          </MenuItem>
        )}
      </For>
      <div class={menuSeparator} />
      <MenuItem
        icon={<CopyIcon size={14} />}
        onClick={async () => {
          const copy = await store.addView(
            `${props.view.name} copy`,
            props.view.type,
            JSON.parse(JSON.stringify(props.view.config)),
          );
          props.close();
          if (copy) props.onDuplicated(copy.id);
        }}
      >
        Duplicate view
      </MenuItem>
      <Show when={store.state.views.length > 1}>
        <MenuItem
          danger
          icon={<Trash2Icon size={14} />}
          onClick={async () => {
            props.close();
            if (await store.deleteView(props.view.id)) props.onDeleted();
          }}
        >
          Delete view
        </MenuItem>
      </Show>
    </div>
  );
};

/** Tabs for a collection's saved views, plus adding a view. */
export const ViewTabs = (props: {
  activeViewId?: string;
  onSelect: (viewId: string) => void;
}) => {
  const { store } = useCollection();
  const [menuFor, setMenuFor] = createSignal<string | null>(null);
  const [adding, setAdding] = createSignal(false);

  const add = async (type: ViewType) => {
    setAdding(false);
    const view = await store.addView(VIEW_LABELS[type], type);
    if (view) props.onSelect(view.id);
  };

  return (
    <div class={bar} role="tablist" aria-label="Views">
      <For each={store.state.views}>
        {(view) => (
          <Show
            when={view.id === props.activeViewId}
            fallback={
              <button
                type="button"
                role="tab"
                class={tab}
                aria-selected={false}
                onClick={() => props.onSelect(view.id)}
              >
                <Dynamic component={VIEW_ICONS[view.type]} size={14} />
                {view.name}
              </button>
            }
          >
            <SimplePopover
              class={fitContent}
              open={menuFor() === view.id}
              onClose={() => setMenuFor(null)}
              anchor={
                <button
                  type="button"
                  role="tab"
                  class={tab}
                  aria-selected={true}
                  aria-haspopup="menu"
                  onClick={() =>
                    setMenuFor((cur) => (cur === view.id ? null : view.id))
                  }
                >
                  <Dynamic component={VIEW_ICONS[view.type]} size={14} />
                  {view.name}
                  <ChevronDownIcon size={12} />
                </button>
              }
            >
              <ViewMenu
                view={view}
                close={() => setMenuFor(null)}
                onDeleted={() =>
                  store.state.views[0] &&
                  props.onSelect(store.state.views[0].id)
                }
                onDuplicated={props.onSelect}
              />
            </SimplePopover>
          </Show>
        )}
      </For>
      <SimplePopover
        class={fitContent}
        open={adding()}
        onClose={() => setAdding(false)}
        anchor={
          <button
            type="button"
            class={addBtn}
            aria-label="Add view"
            onClick={() => setAdding((v) => !v)}
          >
            <PlusIcon size={14} />
          </button>
        }
      >
        <div class={menuPanel}>
          <div class={menuSection}>Add a view</div>
          <For each={VIEW_TYPES}>
            {(type) => (
              <MenuItem
                icon={<Dynamic component={VIEW_ICONS[type]} size={14} />}
                onClick={() => void add(type)}
              >
                {VIEW_LABELS[type]}
              </MenuItem>
            )}
          </For>
        </div>
      </SimplePopover>
    </div>
  );
};
