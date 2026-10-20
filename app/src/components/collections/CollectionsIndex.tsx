import { A, useAction, useNavigate } from "@solidjs/router";
import { DatabaseIcon, PlusIcon } from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { useToasts } from "~/components/Toast";
import { createCollection } from "~/services/collections/collections.actions";
import type { CollectionListItem } from "~/services/collections/collections.queries";

const header = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "3",
  mb: "5",
});
const title = css({ fontSize: "2xl", fontWeight: "bold" });
const list = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(16rem, 1fr))",
  gap: "3",
});
const card = css({
  display: "flex",
  flexDirection: "column",
  gap: "1",
  p: "4",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l3",
  bg: "bg.default",
  _hover: { bg: "bg.subtle", borderColor: "border.emphasized" },
});
const cardTitle = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  fontWeight: "semibold",
  fontSize: "md",
});
const meta = css({ fontSize: "sm", color: "fg.muted" });
const emptyState = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "3",
  p: "6",
  borderWidth: "1px",
  borderStyle: "dashed",
  borderColor: "border",
  borderRadius: "l3",
  maxW: "32rem",
});
const nameInput = css({
  h: "9",
  px: "3",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  bg: "bg.default",
  fontSize: "sm",
  minW: "14rem",
  outline: "none",
  _focus: { borderColor: "border.accent" },
});
const form = css({ display: "flex", gap: "2", alignItems: "center" });

/** The /collections page: every collection, plus creating a new one. */
export const CollectionsIndex = (props: { items: CollectionListItem[] }) => {
  const navigate = useNavigate();
  const run = useAction(createCollection);
  const { show } = useToasts();
  const [creating, setCreating] = createSignal(false);
  const [name, setName] = createSignal("");

  const submit = async () => {
    const value = name().trim();
    if (!value) return;
    try {
      const { id } = await run({ name: value });
      navigate(`/collections/${id}`);
    } catch (error) {
      show({
        title: "Couldn't create the collection",
        message: String((error as Error).message ?? error),
        type: "error",
      });
    }
  };

  const createForm = () => (
    <form
      class={form}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        class={nameInput}
        placeholder="Collection name, e.g. Reading"
        aria-label="New collection name"
        value={name()}
        ref={(el) => queueMicrotask(() => el.focus())}
        onInput={(e) => setName(e.currentTarget.value)}
        onKeyDown={(e) => e.key === "Escape" && setCreating(false)}
      />
      <Button type="submit" size="sm" disabled={!name().trim()}>
        Create
      </Button>
    </form>
  );

  return (
    <div>
      <div class={header}>
        <h1 class={title}>Collections</h1>
        <Show when={props.items.length > 0}>
          <Show
            when={creating()}
            fallback={
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCreating(true)}
              >
                <PlusIcon size={14} /> New collection
              </Button>
            }
          >
            {createForm()}
          </Show>
        </Show>
      </div>
      <Show
        when={props.items.length > 0}
        fallback={
          <div class={emptyState}>
            <DatabaseIcon size={20} />
            <div>
              <div class={css({ fontWeight: "semibold" })}>
                Collect things with structure
              </div>
              <div class={meta}>
                A collection is a set of notes with shared properties, like a
                reading list with status, rating, and tags. View it as a table,
                board, gallery, or calendar.
              </div>
            </div>
            {createForm()}
          </div>
        }
      >
        <div class={list}>
          <For each={props.items}>
            {(item) => (
              <A href={`/collections/${item.id}`} class={card}>
                <span class={cardTitle}>
                  <DatabaseIcon size={16} />
                  {item.name}
                </span>
                <span class={meta}>
                  {item.rowCount} {item.rowCount === 1 ? "row" : "rows"}
                </span>
              </A>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
