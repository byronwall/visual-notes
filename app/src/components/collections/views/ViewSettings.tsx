import {
  CheckIcon,
  Columns3Icon,
  EyeIcon,
  EyeOffIcon,
  IdCardIcon,
} from "lucide-solid";
import { For, type JSX, Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { SimplePopover } from "~/components/ui/simple-popover";
import { canGroupBy } from "~/lib/collections/group";
import { orderedProperties } from "~/lib/collections/query";
import type { CollectionView } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import { MenuItem, menuPanel, menuSection } from "../menu/MenuList";
import { fitContent } from "../popover-styles";
import { PropertyKindIcon } from "../PropertyKindIcon";
import { OptionChip } from "../values/OptionChip";

export const settingsBtn = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  h: "7",
  px: "2",
  borderRadius: "l2",
  color: "fg.muted",
  fontSize: "sm",
  cursor: "pointer",
  _hover: { bg: "bg.muted", color: "fg.default" },
});
const iconBtn = css({
  display: "inline-flex",
  p: "1",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  _hover: { color: "fg.default" },
});

/** A toolbar button that opens a small settings popover. */
export const SettingsPopover = (props: {
  icon: JSX.Element;
  label: JSX.Element;
  children: JSX.Element;
}) => {
  const [open, setOpen] = createSignal(false);
  return (
    <SimplePopover
      class={fitContent}
      open={open()}
      onClose={() => setOpen(false)}
      anchor={
        <button
          type="button"
          class={settingsBtn}
          onClick={() => setOpen((v) => !v)}
        >
          {props.icon}
          {props.label}
        </button>
      }
    >
      {props.children}
    </SimplePopover>
  );
};

/** Board: which select or status property makes the columns, and which columns show. */
export const GroupBySettings = (props: { view: CollectionView }) => {
  const { store } = useCollection();
  const candidates = () => store.state.properties.filter(canGroupBy);
  const current = () =>
    candidates().find((p) => p.id === props.view.config.groupBy) ??
    candidates().find((p) => p.kind === "status") ??
    candidates()[0];
  const hidden = () => new Set(props.view.config.hiddenGroups ?? []);
  const toggleGroup = (key: string) => {
    const next = new Set(hidden());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    store.patchViewConfig(props.view.id, { hiddenGroups: [...next] });
  };
  return (
    <Show when={candidates().length > 0}>
      <SettingsPopover
        icon={<Columns3Icon size={14} />}
        label={<>Group: {current()?.name}</>}
      >
        <div class={menuPanel} style={{ width: "16rem" }}>
          <div class={menuSection}>Group by</div>
          <For each={candidates()}>
            {(p) => (
              <MenuItem
                icon={<PropertyKindIcon property={p} />}
                trailing={
                  current()?.id === p.id ? <CheckIcon size={13} /> : undefined
                }
                onClick={() =>
                  store.patchViewConfig(props.view.id, {
                    groupBy: p.id,
                    hiddenGroups: [],
                  })
                }
              >
                {p.name}
              </MenuItem>
            )}
          </For>
          <Show when={current()}>
            {(p) => (
              <>
                <div class={menuSection}>Columns</div>
                <For
                  each={[
                    ...(p().config.options ?? []).map((o) => ({
                      key: o.id,
                      option: o,
                    })),
                    { key: "__none__", option: null },
                  ]}
                >
                  {(g) => (
                    <div
                      style={{
                        display: "flex",
                        "align-items": "center",
                        gap: "8px",
                        padding: "4px 10px",
                      }}
                    >
                      <Show
                        when={g.option}
                        fallback={
                          <span style={{ flex: "1", "font-size": "12px" }}>
                            No {p().name.toLowerCase()}
                          </span>
                        }
                      >
                        {(o) => (
                          <span style={{ flex: "1" }}>
                            <OptionChip
                              option={o()}
                              showDot={p().kind === "status"}
                            />
                          </span>
                        )}
                      </Show>
                      <button
                        type="button"
                        class={iconBtn}
                        aria-label={
                          hidden().has(g.key) ? "Show column" : "Hide column"
                        }
                        onClick={() => toggleGroup(g.key)}
                      >
                        {hidden().has(g.key) ? (
                          <EyeOffIcon size={13} />
                        ) : (
                          <EyeIcon size={13} />
                        )}
                      </button>
                    </div>
                  )}
                </For>
              </>
            )}
          </Show>
        </div>
      </SettingsPopover>
    </Show>
  );
};

/** Board and gallery: which properties appear on cards. */
export const CardFieldsSettings = (props: {
  view: CollectionView;
  defaultCount?: number;
  exclude?: string;
}) => {
  const { store } = useCollection();
  const all = () =>
    orderedProperties(store.state.properties, props.view.config, {
      includeHidden: true,
    });
  const chosen = () =>
    props.view.config.cardProperties ??
    all()
      .filter((p) => p.id !== props.exclude)
      .slice(0, props.defaultCount ?? 3)
      .map((p) => p.id);
  const toggle = (id: string) => {
    const set = new Set(chosen());
    if (set.has(id)) set.delete(id);
    else set.add(id);
    store.patchViewConfig(props.view.id, {
      cardProperties: all()
        .map((p) => p.id)
        .filter((pid) => set.has(pid)),
    });
  };
  return (
    <SettingsPopover icon={<IdCardIcon size={14} />} label="Card fields">
      <div class={menuPanel} style={{ width: "15rem" }}>
        <div class={menuSection}>Shown on cards</div>
        <For each={all()}>
          {(p) => (
            <MenuItem
              icon={<PropertyKindIcon property={p} />}
              trailing={
                chosen().includes(p.id) ? (
                  <EyeIcon size={13} />
                ) : (
                  <EyeOffIcon size={13} />
                )
              }
              onClick={() => toggle(p.id)}
            >
              {p.name}
            </MenuItem>
          )}
        </For>
      </div>
    </SettingsPopover>
  );
};
