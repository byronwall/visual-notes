import { CheckIcon, PlusIcon, XIcon } from "lucide-solid";
import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { css } from "styled-system/css";
import type { CollectionProperty, SelectOption, StatusGroup } from "~/lib/collections/types";
import { STATUS_GROUPS } from "~/lib/collections/types";
import { optionById } from "~/lib/collections/values";
import { OptionChip } from "./OptionChip";

const GROUP_LABELS: Record<StatusGroup, string> = { todo: "To do", doing: "In progress", done: "Complete" };

const panel = css({ display: "flex", flexDirection: "column", w: "64", maxH: "80", fontSize: "sm" });
const selectedRow = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "1",
  alignItems: "center",
  px: "2",
  py: "1.5",
  borderBottomWidth: "1px",
  borderColor: "border",
  bg: "bg.subtle",
});
const input = css({
  flex: "1",
  minW: "16",
  bg: "transparent",
  outline: "none",
  fontSize: "sm",
  py: "0.5",
});
const list = css({ overflowY: "auto", py: "1" });
const groupLabel = css({ px: "2.5", pt: "2", pb: "1", fontSize: "xs", color: "fg.subtle", fontWeight: "medium" });
const item = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  w: "full",
  px: "2.5",
  py: "1",
  textAlign: "left",
  borderRadius: "l1",
  cursor: "pointer",
  "&[data-active]": { bg: "bg.muted" },
});
const hint = css({ px: "2.5", py: "1", fontSize: "xs", color: "fg.subtle" });
const removeBtn = css({ display: "inline-flex", opacity: "0.6", _hover: { opacity: "1" }, cursor: "pointer" });

type Entry = { kind: "option"; option: SelectOption } | { kind: "create"; name: string };

/** Search, pick, and create options for select, status, and multi-select. */
export const OptionPicker = (props: {
  property: CollectionProperty;
  value: string | string[] | null;
  onChange: (value: string | string[] | null) => void;
  onCreate: (name: string) => Promise<SelectOption | undefined>;
  onDone: () => void;
}) => {
  const multiple = () => props.property.kind === "multi_select";
  const [query, setQuery] = createSignal("");
  const [active, setActive] = createSignal(0);
  let inputEl: HTMLInputElement | undefined;
  onMount(() => queueMicrotask(() => inputEl?.focus()));

  const selectedIds = () =>
    Array.isArray(props.value) ? props.value : typeof props.value === "string" ? [props.value] : [];
  const options = () => props.property.config.options ?? [];
  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase();
    return q ? options().filter((o) => o.name.toLowerCase().includes(q)) : options();
  });
  const entries = createMemo<Entry[]>(() => {
    const out: Entry[] = filtered().map((option) => ({ kind: "option", option }));
    const q = query().trim();
    if (q && !options().some((o) => o.name.toLowerCase() === q.toLowerCase()))
      out.push({ kind: "create", name: q });
    return out;
  });
  const grouped = () => props.property.kind === "status" && !query().trim();

  const choose = async (entry: Entry) => {
    let option: SelectOption | undefined;
    if (entry.kind === "create") option = await props.onCreate(entry.name);
    else option = entry.option;
    if (!option) return;
    setQuery("");
    if (multiple()) {
      const ids = selectedIds();
      props.onChange(ids.includes(option.id) ? ids.filter((id) => id !== option!.id) : [...ids, option.id]);
      inputEl?.focus();
    } else {
      props.onChange(selectedIds()[0] === option.id ? null : option.id);
      props.onDone();
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const count = entries().length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (count ? (i + 1) % count : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (count ? (i - 1 + count) % count : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = entries()[active()];
      if (entry) void choose(entry);
      else props.onDone();
    } else if (e.key === "Backspace" && !query() && multiple() && selectedIds().length) {
      props.onChange(selectedIds().slice(0, -1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      props.onDone();
    }
  };

  const renderEntry = (entry: Entry, index: () => number) => (
    <button
      type="button"
      class={item}
      data-active={active() === index() ? "" : undefined}
      onMouseEnter={() => setActive(index())}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => void choose(entry)}
    >
      <Show
        when={entry.kind === "option" ? entry.option : undefined}
        fallback={
          <>
            <PlusIcon size={14} />
            <span>
              Create <OptionChip option={{ name: (entry as { name: string }).name, color: "gray" }} />
            </span>
          </>
        }
      >
        {(option) => (
          <>
            <OptionChip option={option()} showDot={props.property.kind === "status"} />
            <Show when={selectedIds().includes(option().id)}>
              <CheckIcon size={14} style={{ "margin-left": "auto" }} />
            </Show>
          </>
        )}
      </Show>
    </button>
  );

  return (
    <div class={panel} onKeyDown={onKeyDown}>
      <div class={selectedRow}>
        <For each={selectedIds().map((id) => optionById(props.property.config, id)).filter(Boolean)}>
          {(option) => (
            <OptionChip
              option={option!}
              showDot={props.property.kind === "status"}
              trailing={
                <span
                  class={removeBtn}
                  role="button"
                  aria-label={`Remove ${option!.name}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    props.onChange(multiple() ? selectedIds().filter((id) => id !== option!.id) : null)
                  }
                >
                  <XIcon size={11} />
                </span>
              }
            />
          )}
        </For>
        <input
          ref={inputEl}
          class={input}
          value={query()}
          placeholder={selectedIds().length ? "" : "Search or create…"}
          aria-label={`Search ${props.property.name} options`}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            setActive(0);
          }}
        />
      </div>
      <div class={list} role="listbox">
        <Show
          when={grouped()}
          fallback={<For each={entries()}>{(entry, i) => renderEntry(entry, i)}</For>}
        >
          <For each={STATUS_GROUPS}>
            {(group) => (
              <>
                <div class={groupLabel}>{GROUP_LABELS[group]}</div>
                <For each={entries().filter((e) => e.kind === "option" && (e.option.group ?? "todo") === group)}>
                  {(entry) => renderEntry(entry, () => entries().indexOf(entry))}
                </For>
              </>
            )}
          </For>
        </Show>
        <Show when={entries().length === 0}>
          <div class={hint}>Type to create an option</div>
        </Show>
      </div>
    </div>
  );
};

export { GROUP_LABELS };
