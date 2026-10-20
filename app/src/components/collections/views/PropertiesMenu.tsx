import { ArrowDownIcon, ArrowUpIcon, EyeIcon, EyeOffIcon } from "lucide-solid";
import { For } from "solid-js";
import { css } from "styled-system/css";
import { orderedProperties } from "~/lib/collections/query";
import type { CollectionView } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import { PropertyKindIcon } from "../PropertyKindIcon";
import { menuSection } from "../menu/MenuList";

const panel = css({
  display: "flex",
  flexDirection: "column",
  py: "1",
  w: "17rem",
  fontSize: "sm",
});
const line = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  px: "2.5",
  h: "8",
  "&[data-hidden]": { color: "fg.subtle" },
});
const name = css({
  flex: "1",
  minW: "0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
const iconBtn = css({
  display: "inline-flex",
  p: "1",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  _hover: { color: "fg.default", bg: "bg.muted" },
  _disabled: { opacity: "0.3", cursor: "default" },
});

/** Show, hide, and order properties for one view. */
export const PropertiesMenu = (props: {
  view: CollectionView;
  label?: string;
}) => {
  const { store } = useCollection();
  const ordered = () =>
    orderedProperties(store.state.properties, props.view.config, {
      includeHidden: true,
    });
  const hidden = () => new Set(props.view.config.hiddenProperties ?? []);
  const toggle = (id: string) => {
    const next = new Set(hidden());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    store.patchViewConfig(props.view.id, { hiddenProperties: [...next] });
  };
  const move = (index: number, delta: number) => {
    const ids = ordered().map((p) => p.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id!);
    store.patchViewConfig(props.view.id, { propertyOrder: ids });
  };
  return (
    <div class={panel}>
      <div class={menuSection}>{props.label ?? "Properties in this view"}</div>
      <For each={ordered()}>
        {(p, i) => (
          <div class={line} data-hidden={hidden().has(p.id) ? "" : undefined}>
            <PropertyKindIcon property={p} />
            <span class={name}>{p.name}</span>
            <button
              type="button"
              class={iconBtn}
              aria-label={`Move ${p.name} up`}
              disabled={i() === 0}
              onClick={() => move(i(), -1)}
            >
              <ArrowUpIcon size={12} />
            </button>
            <button
              type="button"
              class={iconBtn}
              aria-label={`Move ${p.name} down`}
              disabled={i() === ordered().length - 1}
              onClick={() => move(i(), 1)}
            >
              <ArrowDownIcon size={12} />
            </button>
            <button
              type="button"
              class={iconBtn}
              aria-label={
                hidden().has(p.id) ? `Show ${p.name}` : `Hide ${p.name}`
              }
              onClick={() => toggle(p.id)}
            >
              {hidden().has(p.id) ? (
                <EyeOffIcon size={13} />
              ) : (
                <EyeIcon size={13} />
              )}
            </button>
          </div>
        )}
      </For>
    </div>
  );
};
