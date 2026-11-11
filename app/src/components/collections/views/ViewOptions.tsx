import { CopyIcon, EllipsisIcon, Trash2Icon } from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { Dynamic } from "solid-js/web";
import { css } from "styled-system/css";
import { noAutofill } from "~/components/ui/no-autofill";
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
import { isCoarsePointer } from "../touch";
import { VIEW_ICONS, VIEW_LABELS } from "./view-meta";

export const optionsBtn = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: "0",
  w: "7",
  h: "7",
  borderRadius: "l2",
  color: "fg.subtle",
  cursor: "pointer",
  transition: "color 140ms, background-color 140ms",
  _hover: { bg: "bg.muted", color: "fg.default" },
  "&[aria-expanded=true]": { bg: "bg.muted", color: "fg.default" },
});

/** Menu items for adding a view of each layout. */
export const AddViewItems = (props: { onAdd: (type: ViewType) => void }) => (
  <For each={VIEW_TYPES}>
    {(type) => (
      <MenuItem
        icon={<Dynamic component={VIEW_ICONS[type]} size={14} />}
        onClick={() => props.onAdd(type)}
      >
        {VIEW_LABELS[type]}
      </MenuItem>
    )}
  </For>
);

/** Rename, change layout, duplicate, delete. */
const ViewMenu = (props: {
  view: CollectionView;
  onDeleted: () => void;
  onDuplicated: (id: string) => void;
  close: () => void;
}) => {
  const { store } = useCollection();
  const rename = (value: string) =>
    value.trim() && void store.renameView(props.view.id, value.trim());
  return (
    <div class={menuPanel} style={{ width: "15rem" }}>
      <input
        {...noAutofill}
        class={menuInput}
        value={props.view.name}
        aria-label="View name"
        onChange={(e) => rename(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          rename(e.currentTarget.value);
          props.close();
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

/** The "…" button beside the active view. Selecting a view never opens this. */
export const ViewOptionsButton = (props: {
  view: CollectionView;
  onSelect: (viewId: string) => void;
}) => {
  const { store } = useCollection();
  const [open, setOpen] = createSignal(false);
  let panel: HTMLDivElement | undefined;
  return (
    <SimplePopover
      class={fitContent}
      open={open()}
      onClose={() => setOpen(false)}
      // The menu starts with the name field; on touch, focusing it would open
      // the keyboard just to change the layout. Focus the panel instead.
      initialFocusEl={() => (isCoarsePointer() ? panel ?? null : null)}
      anchor={
        <button
          type="button"
          class={optionsBtn}
          aria-label="View options"
          title="View options"
          aria-haspopup="menu"
          aria-expanded={open()}
          onClick={() => setOpen((v) => !v)}
        >
          <EllipsisIcon size={14} />
        </button>
      }
    >
      <div ref={panel} tabIndex={-1} style={{ outline: "none" }}>
        <ViewMenu
          view={props.view}
          close={() => setOpen(false)}
          onDeleted={() =>
            store.state.views[0] && props.onSelect(store.state.views[0].id)
          }
          onDuplicated={props.onSelect}
        />
      </div>
    </SimplePopover>
  );
};
