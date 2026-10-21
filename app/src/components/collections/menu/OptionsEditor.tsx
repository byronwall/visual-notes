import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  Trash2Icon,
} from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { OPTION_PALETTE, optionColorVars } from "~/lib/collections/colors";
import {
  OPTION_COLORS,
  STATUS_GROUPS,
  type CollectionProperty,
  type SelectOption,
} from "~/lib/collections/types";
import { GROUP_LABELS } from "../values/OptionPicker";
import { useCollection } from "../CollectionContext";
import { menuSection } from "./MenuList";
import { noAutofill } from "~/components/ui/no-autofill";

// One line per option: color, name (previewed in its chip colors), group,
// and reorder/delete actions that appear on hover.
const row = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  px: "2",
  h: "8",
  "& [data-row-action]": { opacity: "0" },
  // Actions sit at the right edge whether or not a status group select is shown.
  "& > input + [data-row-action]": { ml: "auto" },
  "&:hover [data-row-action], &:focus-within [data-row-action]": {
    opacity: "1",
  },
});
// Sized to the name where the browser supports it, so options read as chips.
const nameInput = css({
  flex: "0 1 auto",
  fieldSizing: "content",
  minW: "12",
  maxW: "full",
  h: "6",
  px: "1.5",
  borderRadius: "l1",
  fontSize: "xs",
  fontWeight: "medium",
  outline: "none",
  bg: "var(--chip-bg)",
  color: "var(--chip-fg)",
  _dark: { bg: "var(--chip-bg-dark)", color: "var(--chip-fg-dark)" },
  _focusVisible: { boxShadow: "0 0 0 1.5px var(--chip-ink)" },
});
const swatch = css({
  boxSize: "4",
  borderRadius: "l1",
  flexShrink: "0",
  cursor: "pointer",
  outlineOffset: "1px",
  transitionProperty: "transform",
  transitionDuration: "140ms",
  _hover: { transform: "scale(1.12)" },
  _focusVisible: { outline: "1.5px solid token(colors.border.accent)" },
  "&[data-selected]": { outline: "1.5px solid token(colors.fg.default)" },
  "@media (prefers-reduced-motion: reduce)": { _hover: { transform: "none" } },
});
const swatches = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "1.5",
  pl: "8",
  pr: "2",
  pt: "0.5",
  pb: "2",
});
const iconBtn = css({
  display: "inline-flex",
  flexShrink: "0",
  p: "1",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  transitionProperty: "opacity, color, background-color",
  transitionDuration: "140ms",
  _hover: { color: "fg.default", bg: "bg.muted" },
  _disabled: { visibility: "hidden" },
});
const groupWrap = css({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  flexShrink: "0",
  ml: "auto",
  color: "fg.muted",
  _hover: { color: "fg.default" },
  "& svg": { position: "absolute", right: "1", pointerEvents: "none" },
});
const groupSelect = css({
  appearance: "none",
  w: "5.75rem",
  h: "6",
  pl: "1.5",
  pr: "5",
  fontSize: "xs",
  bg: "transparent",
  color: "inherit",
  outline: "none",
  cursor: "pointer",
  borderRadius: "l1",
  _hover: { bg: "bg.muted" },
  _focusVisible: { boxShadow: "0 0 0 1.5px token(colors.border.accent)" },
});

/** Rename, recolor, regroup, reorder, and delete a property's options. */
export const OptionsEditor = (props: { property: CollectionProperty }) => {
  const { store } = useCollection();
  // Only the option being recolored shows the swatch row.
  const [recoloring, setRecoloring] = createSignal<string | null>(null);
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
          Options appear here as you add them to values.
        </div>
      </Show>
      <For each={options()}>
        {(option, i) => (
          <div>
            <div class={row} style={optionColorVars(option.color)}>
              <button
                type="button"
                class={swatch}
                style={{ background: OPTION_PALETTE[option.color].ink }}
                aria-label={`Color: ${OPTION_PALETTE[option.color].name}`}
                aria-expanded={recoloring() === option.id}
                title={OPTION_PALETTE[option.color].name}
                onClick={() =>
                  setRecoloring((id) => (id === option.id ? null : option.id))
                }
              />
              <input
                {...noAutofill}
                class={nameInput}
                value={option.name}
                aria-label="Option name"
                onChange={(e) => {
                  const name = e.currentTarget.value.trim();
                  if (name && name !== option.name) patch(option.id, { name });
                }}
              />
              <Show when={props.property.kind === "status"}>
                <span class={groupWrap}>
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
                  <ChevronDownIcon size={12} />
                </span>
              </Show>
              <button
                type="button"
                class={iconBtn}
                data-row-action=""
                aria-label="Move up"
                disabled={i() === 0}
                onClick={() => move(i(), -1)}
              >
                <ArrowUpIcon size={12} />
              </button>
              <button
                type="button"
                class={iconBtn}
                data-row-action=""
                aria-label="Move down"
                disabled={i() === options().length - 1}
                onClick={() => move(i(), 1)}
              >
                <ArrowDownIcon size={12} />
              </button>
              <button
                type="button"
                class={iconBtn}
                data-row-action=""
                aria-label={`Delete ${option.name}`}
                onClick={() => remove(option)}
              >
                <Trash2Icon size={12} />
              </button>
            </div>
            <Show when={recoloring() === option.id}>
              <div class={swatches} role="group" aria-label="Option color">
                <For each={OPTION_COLORS}>
                  {(color) => (
                    <button
                      type="button"
                      class={swatch}
                      aria-label={`${OPTION_PALETTE[color].name} color`}
                      title={OPTION_PALETTE[color].name}
                      data-selected={option.color === color ? "" : undefined}
                      style={{ background: OPTION_PALETTE[color].ink }}
                      onClick={() => patch(option.id, { color })}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
};
