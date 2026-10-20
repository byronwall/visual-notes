import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from "lucide-solid";
import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { OPTION_COLOR_HSL } from "~/lib/collections/colors";
import {
  OPTION_COLORS,
  STATUS_GROUPS,
  type CollectionProperty,
  type SelectOption,
} from "~/lib/collections/types";
import { GROUP_LABELS } from "../values/OptionPicker";
import { useCollection } from "../CollectionContext";
import { menuSection } from "./MenuList";

const row = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  px: "2",
  py: "1",
});
const nameInput = css({
  flex: "1",
  minW: "0",
  h: "7",
  px: "1.5",
  borderRadius: "l1",
  bg: "transparent",
  fontSize: "sm",
  outline: "none",
  _hover: { bg: "bg.muted" },
  _focus: { bg: "bg.muted" },
});
const swatch = css({
  boxSize: "4",
  borderRadius: "full",
  flexShrink: "0",
  cursor: "pointer",
  borderWidth: "2px",
  borderColor: "transparent",
  "&[data-selected]": { borderColor: "fg.default" },
});
const swatches = css({
  display: "flex",
  gap: "1",
  px: "2",
  pb: "1.5",
  pl: "8",
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
const groupSelect = css({
  fontSize: "xs",
  bg: "transparent",
  color: "fg.muted",
  outline: "none",
  cursor: "pointer",
});

/** Rename, recolor, regroup, reorder, and delete a property's options. */
export const OptionsEditor = (props: { property: CollectionProperty }) => {
  const { store } = useCollection();
  const options = () => props.property.config.options ?? [];
  const save = (next: SelectOption[]) =>
    void store.updateProperty(props.property.id, {
      config: { ...props.property.config, options: next },
    });
  const patch = (id: string, change: Partial<SelectOption>) =>
    save(options().map((o) => (o.id === id ? { ...o, ...change } : o)));
  const move = (index: number, delta: number) => {
    const next = [...options()];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    save(next);
  };
  const remove = (option: SelectOption) => {
    save(options().filter((o) => o.id !== option.id));
    // Clear the removed option from rows so nothing points at it.
    const affected = store.state.rows.filter((r) => {
      const v = r.properties[props.property.id];
      return v === option.id || (Array.isArray(v) && v.includes(option.id));
    });
    for (const row of affected) {
      const v = row.properties[props.property.id];
      void store.setValues([row.id], {
        [props.property.id]: Array.isArray(v)
          ? (v.filter((id) => id !== option.id) as string[])
          : null,
      });
    }
  };

  return (
    <div>
      <div class={menuSection}>Options</div>
      <Show when={options().length === 0}>
        <div
          class={css({
            px: "2.5",
            pb: "2",
            fontSize: "xs",
            color: "fg.subtle",
          })}
        >
          Options appear here as you create them in cells.
        </div>
      </Show>
      <For each={options()}>
        {(option, i) => (
          <div>
            <div class={row}>
              <span
                class={swatch}
                style={{
                  background: `hsl(${OPTION_COLOR_HSL[option.color].h} ${OPTION_COLOR_HSL[option.color].s}% 60%)`,
                }}
              />
              <input
                class={nameInput}
                value={option.name}
                aria-label="Option name"
                onChange={(e) => {
                  const name = e.currentTarget.value.trim();
                  if (name && name !== option.name) patch(option.id, { name });
                }}
              />
              <Show when={props.property.kind === "status"}>
                <select
                  class={groupSelect}
                  aria-label="Status group"
                  value={option.group ?? "todo"}
                  onChange={(e) =>
                    patch(option.id, {
                      group: e.currentTarget.value as SelectOption["group"],
                    })
                  }
                >
                  <For each={STATUS_GROUPS}>
                    {(g) => <option value={g}>{GROUP_LABELS[g]}</option>}
                  </For>
                </select>
              </Show>
              <button
                type="button"
                class={iconBtn}
                aria-label="Move up"
                disabled={i() === 0}
                onClick={() => move(i(), -1)}
              >
                <ArrowUpIcon size={12} />
              </button>
              <button
                type="button"
                class={iconBtn}
                aria-label="Move down"
                disabled={i() === options().length - 1}
                onClick={() => move(i(), 1)}
              >
                <ArrowDownIcon size={12} />
              </button>
              <button
                type="button"
                class={iconBtn}
                aria-label={`Delete ${option.name}`}
                onClick={() => remove(option)}
              >
                <Trash2Icon size={12} />
              </button>
            </div>
            <div class={swatches}>
              <For each={OPTION_COLORS}>
                {(color) => (
                  <button
                    type="button"
                    class={swatch}
                    aria-label={`${color} color`}
                    data-selected={option.color === color ? "" : undefined}
                    style={{
                      background: `hsl(${OPTION_COLOR_HSL[color].h} ${OPTION_COLOR_HSL[color].s}% 60%)`,
                    }}
                    onClick={() => patch(option.id, { color })}
                  />
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
};
