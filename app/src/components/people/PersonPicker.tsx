import { useAction } from "@solidjs/router";
import { PlusIcon, XIcon } from "lucide-solid";
import { For, Show, createResource, createSignal, onCleanup } from "solid-js";
import { css } from "styled-system/css";
import { Input } from "~/components/ui/input";
import type { PersonRef } from "~/lib/people/types";
import { createPersonAction } from "~/services/people/people.actions";
import { fetchPersonCandidates } from "~/services/people/people.queries";
import { onDemand } from "~/utils/kept-async";

export type PickedPerson = PersonRef & { countsAsContact: boolean };

const chips = css({ display: "flex", flexWrap: "wrap", gap: "1.5", mb: "1.5" });
const chip = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  pl: "2",
  pr: "1",
  py: "0.5",
  borderRadius: "l2",
  bg: "bg.subtle",
  borderWidth: "1px",
  borderColor: "border",
  fontSize: "sm",
});
const roleToggle = css({
  fontSize: "xs",
  color: "fg.muted",
  px: "1.5",
  borderRadius: "l1",
  cursor: "pointer",
  _hover: { bg: "bg.muted", color: "fg.default" },
  "&[data-discussed]": { color: "amber.11" },
});
const iconButton = css({
  display: "inline-flex",
  p: "0.5",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  _hover: { bg: "bg.muted", color: "fg.default" },
});
const list = css({
  mt: "1",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  bg: "bg.default",
  overflow: "hidden",
});
const option = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  w: "full",
  px: "2.5",
  py: "1.5",
  fontSize: "sm",
  textAlign: "left",
  cursor: "pointer",
  _hover: { bg: "bg.subtle" },
  "&[data-active]": { bg: "bg.subtle" },
});
const optionMeta = css({ color: "fg.subtle", fontSize: "xs", ml: "auto" });

/**
 * Pick existing people by name or alias, or create a missing one inline.
 * `multiple` adds a spoke-with / discussed toggle on each chip.
 */
export function PersonPicker(props: {
  id: string;
  value: PickedPerson[];
  onChange: (next: PickedPerson[]) => void;
  multiple: boolean;
  onError: (message: string) => void;
}) {
  const [text, setText] = createSignal("");
  const [term, setTerm] = createSignal("");
  const [active, setActive] = createSignal(0);
  const [creating, setCreating] = createSignal(false);
  const create = useAction(createPersonAction);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  const [candidates] = createResource(
    () => term().trim() || false,
    (q) => fetchPersonCandidates(q),
    onDemand,
  );
  const chosen = () => new Set(props.value.map((p) => p.id));
  const options = () =>
    (candidates.latest ?? []).filter((p) => !chosen().has(p.id));
  const exact = () =>
    options().some(
      (p) => p.displayName.toLowerCase() === text().trim().toLowerCase(),
    );
  // Results match what is typed only once the debounce and fetch finish;
  // before that, "no exact match" could just mean "not loaded yet".
  const settled = () => text().trim() === term().trim() && !candidates.loading;
  const showCreate = () => text().trim().length > 0 && settled() && !exact();
  const count = () => options().length + (showCreate() ? 1 : 0);

  const onInput = (value: string) => {
    setText(value);
    setActive(0);
    clearTimeout(timer);
    timer = setTimeout(() => setTerm(value), 150);
  };

  const add = (person: PersonRef) => {
    const next = { ...person, countsAsContact: true };
    props.onChange(props.multiple ? [...props.value, next] : [next]);
    setText("");
    setTerm("");
  };

  // One retry key per typed name, so a retry after a lost response returns
  // the person the first attempt created instead of a second one.
  const createKeys = new Map<string, string>();
  const createMissing = async () => {
    const name = text().trim();
    if (!name || creating()) return;
    const requestKey = createKeys.get(name) ?? crypto.randomUUID();
    createKeys.set(name, requestKey);
    setCreating(true);
    try {
      add(await create({ displayName: name, requestKey }));
    } catch (err) {
      console.warn("[people] inline create failed", err);
      props.onError(`Could not create ${name}. Try again.`);
    } finally {
      setCreating(false);
    }
  };

  const choose = (index: number) => {
    const person = options()[index];
    if (person) add(person);
    else if (showCreate()) void createMissing();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" && count()) {
      e.preventDefault();
      setActive((i) => (i + 1) % count());
    } else if (e.key === "ArrowUp" && count()) {
      e.preventDefault();
      setActive((i) => (i - 1 + count()) % count());
    } else if (e.key === "Enter" && text().trim()) {
      e.preventDefault();
      if (!settled()) {
        // Search now instead of acting on stale results; Enter again picks.
        clearTimeout(timer);
        setTerm(text());
        return;
      }
      choose(active());
    } else if (e.key === "Backspace" && !text() && props.value.length) {
      props.onChange(props.value.slice(0, -1));
    }
  };

  const toggleRole = (id: string) =>
    props.onChange(
      props.value.map((p) =>
        p.id === id ? { ...p, countsAsContact: !p.countsAsContact } : p,
      ),
    );

  return (
    <div>
      <Show when={props.value.length}>
        <div class={chips}>
          <For each={props.value}>
            {(p) => (
              <span class={chip} data-person-chip={p.displayName}>
                {p.displayName}
                <Show when={props.multiple}>
                  <button
                    type="button"
                    class={roleToggle}
                    data-discussed={p.countsAsContact ? undefined : ""}
                    title="Spoke with counts as contact; discussed does not"
                    onClick={() => toggleRole(p.id)}
                  >
                    {p.countsAsContact ? "spoke with" : "discussed"}
                  </button>
                </Show>
                <button
                  type="button"
                  class={iconButton}
                  aria-label={`Remove ${p.displayName}`}
                  onClick={() =>
                    props.onChange(props.value.filter((x) => x.id !== p.id))
                  }
                >
                  <XIcon size={12} />
                </button>
              </span>
            )}
          </For>
        </div>
      </Show>
      <Show when={props.multiple || !props.value.length}>
        <Input
          id={props.id}
          size="sm"
          autocomplete="off"
          placeholder={props.multiple ? "Add a person" : "Find a person"}
          value={text()}
          onInput={(e) => onInput(e.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
        <Show when={text().trim() && count()}>
          <div class={list} role="listbox">
            <For each={options()}>
              {(p, i) => (
                <button
                  type="button"
                  class={option}
                  role="option"
                  data-active={active() === i() ? "" : undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(i())}
                >
                  {p.displayName}
                  <span class={optionMeta}>
                    {p.contexts.slice(0, 2).join(", ") || p.location || ""}
                  </span>
                </button>
              )}
            </For>
            <Show when={showCreate()}>
              <button
                type="button"
                class={option}
                role="option"
                data-active={active() === options().length ? "" : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void createMissing()}
              >
                <PlusIcon size={14} />
                {creating() ? "Creating…" : `Create “${text().trim()}”`}
              </button>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
}
