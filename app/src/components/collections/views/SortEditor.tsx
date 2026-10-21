import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-solid";
import { For, Index, Show } from "solid-js";
import { css } from "styled-system/css";
import { withTitle } from "~/lib/collections/query";
import type { CollectionProperty, SortRule } from "~/lib/collections/types";

const panel = css({
  display: "flex",
  flexDirection: "column",
  gap: "2",
  p: "3",
  w: "min(26rem, 92vw)",
  fontSize: "sm",
});
const line = css({ display: "flex", alignItems: "center", gap: "1.5" });
const control = css({
  h: "7",
  px: "1.5",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l1",
  bg: "bg.default",
  fontSize: "sm",
  outline: "none",
  flex: "1",
  minW: "0",
  _focus: { borderColor: "border.accent" },
});
const iconBtn = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  h: "7",
  px: "1.5",
  borderRadius: "l1",
  color: "fg.muted",
  fontSize: "xs",
  cursor: "pointer",
  _hover: { color: "fg.default", bg: "bg.muted" },
  _disabled: { opacity: "0.3", cursor: "default" },
});
const hint = css({ color: "fg.subtle", fontSize: "xs" });

/** Ordered sort rules; earlier rules win, later ones break ties. */
export const SortEditor = (props: {
  properties: CollectionProperty[];
  sorts: SortRule[] | undefined;
  onChange: (sorts: SortRule[]) => void;
}) => {
  const all = () => withTitle(props.properties);
  const rules = () => props.sorts ?? [];
  const set = (index: number, rule: SortRule) =>
    props.onChange(rules().map((r, i) => (i === index ? rule : r)));
  const unused = () =>
    all().find((p) => !rules().some((r) => r.propertyId === p.id));
  const move = (index: number, delta: number) => {
    const next = [...rules()];
    const [rule] = next.splice(index, 1);
    next.splice(index + delta, 0, rule!);
    props.onChange(next);
  };
  return (
    <div class={panel}>
      <Show when={rules().length === 0}>
        <span class={hint}>No sorts. Rows keep their manual order.</span>
      </Show>
      <Index each={rules()}>
        {(rule, i) => (
          <div class={line}>
            <select
              class={control}
              aria-label="Sort property"
              value={rule().propertyId}
              onChange={(e) =>
                set(i, { ...rule(), propertyId: e.currentTarget.value })
              }
            >
              <For each={all()}>
                {(p) => <option value={p.id}>{p.name}</option>}
              </For>
            </select>
            <select
              class={control}
              style={{ flex: "0 0 8rem" }}
              aria-label="Sort direction"
              value={rule().direction}
              onChange={(e) =>
                set(i, {
                  ...rule(),
                  direction: e.currentTarget.value as SortRule["direction"],
                })
              }
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
            <button
              type="button"
              class={iconBtn}
              aria-label="Move sort up"
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              <ArrowUpIcon size={12} />
            </button>
            <button
              type="button"
              class={iconBtn}
              aria-label="Move sort down"
              disabled={i === rules().length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDownIcon size={12} />
            </button>
            <button
              type="button"
              class={iconBtn}
              aria-label="Remove sort"
              onClick={() => props.onChange(rules().filter((_, k) => k !== i))}
            >
              <Trash2Icon size={12} />
            </button>
          </div>
        )}
      </Index>
      <Show when={unused()}>
        {(p) => (
          <button
            type="button"
            class={iconBtn}
            style={{ "align-self": "flex-start" }}
            onClick={() =>
              props.onChange([
                ...rules(),
                { propertyId: p().id, direction: "asc" },
              ])
            }
          >
            <PlusIcon size={12} /> Add sort
          </button>
        )}
      </Show>
    </div>
  );
};
