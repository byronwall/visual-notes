import { PlusIcon } from "lucide-solid";
import {
  For,
  Show,
  createResource,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js";
import { css } from "styled-system/css";
import { Input } from "~/components/ui/input";
import { onDemand } from "~/utils/kept-async";

export type PickItem = { id: string; label: string; meta?: string | null };

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
const meta = css({
  color: "fg.subtle",
  fontSize: "xs",
  ml: "auto",
  truncate: true,
});

/**
 * A text box with matches listed under it (in-flow, so it never needs a
 * portal inside dialogs or side columns). `onCreate` adds a "Create" row.
 */
export function SearchPicker(props: {
  id?: string;
  placeholder: string;
  search: (q: string) => Promise<PickItem[]>;
  onPick: (item: PickItem) => void;
  onCreate?: (text: string) => void | Promise<void>;
  autofocus?: boolean;
}) {
  const [text, setText] = createSignal("");
  const [term, setTerm] = createSignal("");
  const [active, setActive] = createSignal(0);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  const [items] = createResource(
    () => term().trim() || false,
    // The fetcher reads the current prop on each search.
    (q) => untrack(() => props.search)(q),
    onDemand,
  );
  const options = () => items.latest ?? [];
  const exact = () =>
    options().some(
      (o) => o.label.toLowerCase() === text().trim().toLowerCase(),
    );
  // Until the search for the typed text returns, "no exact match" may only
  // mean "not loaded yet", so Create waits for it.
  const settled = () => text().trim() === term().trim() && !items.loading;
  const showCreate = () =>
    !!props.onCreate && !!text().trim() && settled() && !exact();
  const count = () => options().length + (showCreate() ? 1 : 0);

  const choose = (i: number) => {
    const item = options()[i];
    if (item) props.onPick(item);
    else if (showCreate()) void props.onCreate!(text().trim());
    setText("");
    setTerm("");
  };

  return (
    <div>
      <Input
        id={props.id}
        size="sm"
        autocomplete="off"
        placeholder={props.placeholder}
        value={text()}
        ref={(el) => props.autofocus && requestAnimationFrame(() => el.focus())}
        onInput={(e) => {
          const v = e.currentTarget.value;
          setText(v);
          setActive(0);
          clearTimeout(timer);
          timer = setTimeout(() => setTerm(v), 150);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && count()) {
            e.preventDefault();
            setActive((i) => (i + 1) % count());
          } else if (e.key === "ArrowUp" && count()) {
            e.preventDefault();
            setActive((i) => (i - 1 + count()) % count());
          } else if (e.key === "Enter" && text().trim()) {
            e.preventDefault();
            if (!settled()) {
              clearTimeout(timer);
              setTerm(text());
              return;
            }
            choose(active());
          }
        }}
      />
      <Show when={text().trim() && count()}>
        <div class={list} role="listbox">
          <For each={options()}>
            {(o, i) => (
              <button
                type="button"
                role="option"
                class={option}
                data-active={active() === i() ? "" : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i())}
              >
                {o.label}
                <Show when={o.meta}>
                  <span class={meta}>{o.meta}</span>
                </Show>
              </button>
            )}
          </For>
          <Show when={showCreate()}>
            <button
              type="button"
              role="option"
              class={option}
              data-active={active() === options().length ? "" : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(options().length)}
            >
              <PlusIcon size={14} /> Create “{text().trim()}”
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
