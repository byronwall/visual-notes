import { PlusIcon, Trash2Icon } from "lucide-solid";
import { For, Index, Match, Show, Switch } from "solid-js";
import { css } from "styled-system/css";
import {
  OPERATOR_LABELS,
  operatorTakesValue,
  operatorsFor,
  withTitle,
} from "~/lib/collections/query";
import type {
  CollectionProperty,
  FilterCondition,
  FilterGroup,
  FilterOperator,
  FilterTree,
  StatusGroup,
} from "~/lib/collections/types";
import { STATUS_GROUPS } from "~/lib/collections/types";
import { OptionChip } from "../values/OptionChip";
import { GROUP_LABELS } from "../values/OptionPicker";

const panel = css({
  display: "flex",
  flexDirection: "column",
  gap: "2",
  p: "3",
  w: "min(40rem, 92vw)",
  fontSize: "sm",
});
const line = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  flexWrap: "wrap",
});
const group = css({
  display: "flex",
  flexDirection: "column",
  gap: "1.5",
  p: "2",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  bg: "bg.subtle",
  flex: "1",
});
const control = css({
  h: "7",
  px: "1.5",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l1",
  bg: "bg.default",
  fontSize: "sm",
  outline: "none",
  minW: "0",
  _focus: { borderColor: "border.accent" },
});
const conj = css({
  w: "16",
  flexShrink: "0",
  color: "fg.muted",
  fontSize: "xs",
});
const iconBtn = css({
  display: "inline-flex",
  p: "1",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  _hover: { color: "fg.default", bg: "bg.muted" },
});
const addBtn = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  h: "7",
  px: "2",
  borderRadius: "l1",
  color: "fg.muted",
  fontSize: "xs",
  cursor: "pointer",
  _hover: { color: "fg.default", bg: "bg.muted" },
});
const chipToggle = css({
  cursor: "pointer",
  opacity: "0.45",
  borderRadius: "l1",
  "&[data-on]": {
    opacity: "1",
    boxShadow: "0 0 0 1.5px token(colors.fg.muted)",
  },
});
const empty = css({ color: "fg.subtle", fontSize: "xs" });

const newId = () => Math.random().toString(36).slice(2, 9);
const isGroup = (item: FilterCondition | FilterGroup): item is FilterGroup =>
  "conditions" in item;

const defaultCondition = (property: CollectionProperty): FilterCondition => ({
  id: newId(),
  propertyId: property.id,
  op: operatorsFor(property.kind)[0]!,
});

/** Value input for one condition, shaped by the property kind and operator. */
const ConditionValue = (props: {
  property: CollectionProperty;
  condition: FilterCondition;
  onChange: (value: unknown) => void;
}) => {
  const values = () =>
    Array.isArray(props.condition.value)
      ? (props.condition.value as string[])
      : [];
  const toggle = (id: string) =>
    props.onChange(
      values().includes(id)
        ? values().filter((v) => v !== id)
        : [...values(), id],
    );
  return (
    <Show when={operatorTakesValue(props.condition.op)}>
      <Switch
        fallback={
          <input
            class={control}
            value={String(props.condition.value ?? "")}
            placeholder="Value"
            aria-label="Filter value"
            onInput={(e) => props.onChange(e.currentTarget.value)}
          />
        }
      >
        <Match when={props.condition.op === "group_is"}>
          <span class={line}>
            <For each={STATUS_GROUPS}>
              {(g: StatusGroup) => (
                <button
                  type="button"
                  class={chipToggle}
                  data-on={values().includes(g) ? "" : undefined}
                  onClick={() => toggle(g)}
                >
                  <OptionChip
                    option={{
                      name: GROUP_LABELS[g],
                      color:
                        g === "todo"
                          ? "gray"
                          : g === "doing"
                            ? "blue"
                            : "green",
                    }}
                  />
                </button>
              )}
            </For>
          </span>
        </Match>
        <Match
          when={["select", "status", "multi_select"].includes(
            props.property.kind,
          )}
        >
          <span class={line}>
            <For
              each={props.property.config.options ?? []}
              fallback={<span class={empty}>No options yet</span>}
            >
              {(option) => (
                <button
                  type="button"
                  class={chipToggle}
                  data-on={values().includes(option.id) ? "" : undefined}
                  onClick={() => toggle(option.id)}
                >
                  <OptionChip option={option} />
                </button>
              )}
            </For>
          </span>
        </Match>
        <Match
          when={
            props.condition.op === "past_days" ||
            props.condition.op === "next_days" ||
            props.property.kind === "number"
          }
        >
          <input
            class={control}
            style={{ width: "6rem" }}
            type="number"
            value={String(props.condition.value ?? "")}
            aria-label="Filter number"
            onInput={(e) =>
              props.onChange(
                e.currentTarget.value === ""
                  ? undefined
                  : Number(e.currentTarget.value),
              )
            }
          />
        </Match>
        <Match
          when={["date", "created_time", "updated_time"].includes(
            props.property.kind,
          )}
        >
          <input
            class={control}
            type="date"
            value={String(props.condition.value ?? "")}
            aria-label="Filter date"
            onInput={(e) => props.onChange(e.currentTarget.value || undefined)}
          />
        </Match>
      </Switch>
    </Show>
  );
};

const ConditionRow = (props: {
  condition: FilterCondition;
  properties: CollectionProperty[];
  onChange: (next: FilterCondition) => void;
  onRemove: () => void;
}) => {
  const property = () =>
    props.properties.find((p) => p.id === props.condition.propertyId) ??
    props.properties[0]!;
  return (
    <div class={line}>
      <select
        class={control}
        aria-label="Filter property"
        value={property().id}
        onChange={(e) => {
          const next = props.properties.find(
            (p) => p.id === e.currentTarget.value,
          )!;
          props.onChange({ ...defaultCondition(next), id: props.condition.id });
        }}
      >
        <For each={props.properties}>
          {(p) => <option value={p.id}>{p.name}</option>}
        </For>
      </select>
      <select
        class={control}
        aria-label="Filter operator"
        value={props.condition.op}
        onChange={(e) =>
          props.onChange({
            ...props.condition,
            op: e.currentTarget.value as FilterOperator,
            value: undefined,
          })
        }
      >
        <For each={operatorsFor(property().kind)}>
          {(op) => <option value={op}>{OPERATOR_LABELS[op]}</option>}
        </For>
      </select>
      <ConditionValue
        property={property()}
        condition={props.condition}
        onChange={(value) => props.onChange({ ...props.condition, value })}
      />
      <button
        type="button"
        class={iconBtn}
        aria-label="Remove filter"
        onClick={() => props.onRemove()}
      >
        <Trash2Icon size={13} />
      </button>
    </div>
  );
};

/** Builds a filter tree: conditions joined by AND/OR, with one level of groups. */
export const FilterEditor = (props: {
  properties: CollectionProperty[];
  filter: FilterTree | undefined;
  onChange: (filter: FilterTree | undefined) => void;
}) => {
  const all = () => withTitle(props.properties);
  const tree = (): FilterTree =>
    props.filter ?? { conjunction: "and", items: [] };
  const commit = (next: FilterTree) =>
    props.onChange(next.items.length ? next : undefined);
  const setItem = (index: number, item: FilterCondition | FilterGroup) =>
    commit({
      ...tree(),
      items: tree().items.map((it, i) => (i === index ? item : it)),
    });
  const removeItem = (index: number) =>
    commit({ ...tree(), items: tree().items.filter((_, i) => i !== index) });

  const conjunctionLabel = (
    index: number,
    value: "and" | "or",
    onSet: (v: "and" | "or") => void,
  ) =>
    index === 0 ? (
      <span class={conj}>Where</span>
    ) : index === 1 ? (
      <select
        class={`${control} ${conj}`}
        aria-label="Join conditions with"
        value={value}
        onChange={(e) => onSet(e.currentTarget.value as "and" | "or")}
      >
        <option value="and">and</option>
        <option value="or">or</option>
      </select>
    ) : (
      <span class={conj}>{value}</span>
    );

  return (
    <div class={panel}>
      <Show when={tree().items.length === 0}>
        <span class={empty}>No filters. Rows are shown unfiltered.</span>
      </Show>
      <Index each={tree().items}>
        {(item, i) => (
          <div class={line} style={{ "align-items": "flex-start" }}>
            {conjunctionLabel(i, tree().conjunction, (conjunction) =>
              commit({ ...tree(), conjunction }),
            )}
            <Show
              when={isGroup(item()) ? (item() as FilterGroup) : undefined}
              fallback={
                <ConditionRow
                  condition={item() as FilterCondition}
                  properties={all()}
                  onChange={(next) => setItem(i, next)}
                  onRemove={() => removeItem(i)}
                />
              }
            >
              {(g) => (
                <div class={group}>
                  <Index each={g().conditions}>
                    {(c, j) => (
                      <div class={line}>
                        {conjunctionLabel(j, g().conjunction, (conjunction) =>
                          setItem(i, { ...g(), conjunction }),
                        )}
                        <ConditionRow
                          condition={c()}
                          properties={all()}
                          onChange={(next) =>
                            setItem(i, {
                              ...g(),
                              conditions: g().conditions.map((x, k) =>
                                k === j ? next : x,
                              ),
                            })
                          }
                          onRemove={() => {
                            const conditions = g().conditions.filter(
                              (_, k) => k !== j,
                            );
                            if (conditions.length)
                              setItem(i, { ...g(), conditions });
                            else removeItem(i);
                          }}
                        />
                      </div>
                    )}
                  </Index>
                  <button
                    type="button"
                    class={addBtn}
                    onClick={() =>
                      setItem(i, {
                        ...g(),
                        conditions: [
                          ...g().conditions,
                          defaultCondition(all()[0]!),
                        ],
                      })
                    }
                  >
                    <PlusIcon size={12} /> Add to group
                  </button>
                </div>
              )}
            </Show>
          </div>
        )}
      </Index>
      <div class={line}>
        <button
          type="button"
          class={addBtn}
          onClick={() =>
            commit({
              ...tree(),
              items: [...tree().items, defaultCondition(all()[1] ?? all()[0]!)],
            })
          }
        >
          <PlusIcon size={12} /> Add filter
        </button>
        <button
          type="button"
          class={addBtn}
          onClick={() =>
            commit({
              ...tree(),
              items: [
                ...tree().items,
                {
                  id: newId(),
                  conjunction: tree().conjunction === "and" ? "or" : "and",
                  conditions: [defaultCondition(all()[1] ?? all()[0]!)],
                },
              ],
            })
          }
        >
          <PlusIcon size={12} /> Add filter group
        </button>
      </div>
    </div>
  );
};
