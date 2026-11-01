import { useAction } from "@solidjs/router";
import { For, Show, createResource, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { useToasts } from "~/components/Toast";
import {
  addNotesToCollection,
  searchNotesForCollection,
} from "~/services/collections/collections.membership";
import { useCollection } from "../CollectionContext";
import { noAutofill } from "~/components/ui/no-autofill";
import { onDemand } from "~/utils/kept-async";

const filters = css({ display: "flex", gap: "2", mb: "2", w: "full" });
const input = css({
  flex: "1",
  h: "9",
  px: "3",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  bg: "bg.default",
  fontSize: "sm",
  outline: "none",
  _focus: { borderColor: "border.accent" },
});
const list = css({
  display: "flex",
  flexDirection: "column",
  w: "full",
  maxH: "min(55vh, 28rem)",
  overflowY: "auto",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
});
const item = css({
  display: "flex",
  alignItems: "center",
  gap: "2.5",
  px: "3",
  h: "10",
  fontSize: "sm",
  cursor: "pointer",
  borderBottomWidth: "1px",
  borderColor: "border",
  "&:last-child": { borderBottomWidth: "0" },
  _hover: { bg: "bg.subtle" },
});
const titleCls = css({
  flex: "1",
  minW: "0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
const meta = css({
  fontSize: "xs",
  color: "fg.subtle",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxW: "40%",
});
const note = css({ fontSize: "xs", color: "fg.muted", mt: "2" });
const footer = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  w: "full",
  justifyContent: "flex-end",
});

/** Pick existing notes (by title search or path) and add them as rows. */
export const AddNotesDialog = (props: {
  open: boolean;
  onClose: () => void;
}) => {
  const { store } = useCollection();
  const run = useAction(addNotesToCollection);
  const { show } = useToasts();
  const [q, setQ] = createSignal("");
  const [path, setPath] = createSignal("");
  const [picked, setPicked] = createSignal<Set<string>>(new Set());
  const [busy, setBusy] = createSignal(false);
  let searchEl: HTMLInputElement | undefined;
  const [candidates] = createResource(
    () =>
      props.open
        ? { collectionId: store.state.collection.id, q: q(), path: path() }
        : false,
    (args) => searchNotesForCollection(args),
    onDemand,
  );

  const toggle = (id: string) => {
    const next = new Set(picked());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const all = () => candidates.latest ?? [];
  const allPicked = () =>
    all().length > 0 && all().every((c) => picked().has(c.id));

  const submit = async () => {
    const ids = [...picked()];
    if (!ids.length) return;
    setBusy(true);
    try {
      const result = await run({
        collectionId: store.state.collection.id,
        docIds: ids,
      });
      for (const p of result.properties) store.replaceProperty(p);
      store.replaceRows([
        ...store.state.rows.filter((r) => !ids.includes(r.id)),
        ...result.rows,
      ]);
      show({
        title: `Added ${ids.length} ${ids.length === 1 ? "note" : "notes"}`,
        message: store.state.collection.name,
        type: "success",
      });
      setPicked(new Set<string>());
      props.onClose();
    } catch (error) {
      show({
        title: "Couldn't add notes",
        message: String((error as Error).message ?? error),
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SimpleDialog
      open={props.open}
      onClose={props.onClose}
      title={`Add notes to ${store.state.collection.name}`}
      description="Notes keep their content. Meta keys that match property names fill those properties."
      maxW="40rem"
      initialFocusEl={() => searchEl ?? null}
      footer={
        <div class={footer}>
          <Button variant="outline" size="sm" onClick={() => props.onClose()}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!picked().size || busy()}
            onClick={() => void submit()}
          >
            Add {picked().size || ""} {picked().size === 1 ? "note" : "notes"}
          </Button>
        </div>
      }
    >
      <div class={filters}>
        <input
          {...noAutofill}
          ref={searchEl}
          class={input}
          placeholder="Search titles"
          aria-label="Search notes"
          value={q()}
          onInput={(e) => setQ(e.currentTarget.value)}
        />
        <input
          {...noAutofill}
          class={input}
          placeholder="Path starts with, e.g. work.papers"
          aria-label="Path prefix"
          value={path()}
          onInput={(e) => setPath(e.currentTarget.value)}
        />
      </div>
      <div class={list} role="listbox" aria-multiselectable="true">
        <Show when={all().length > 0}>
          <label class={item} style={{ "font-weight": 500 }}>
            <input
              type="checkbox"
              checked={allPicked()}
              onChange={() =>
                setPicked(
                  allPicked()
                    ? new Set<string>()
                    : new Set(all().map((c) => c.id)),
                )
              }
            />
            <span class={titleCls}>Select all {all().length} shown</span>
          </label>
        </Show>
        <For
          each={all()}
          fallback={
            <div class={item} style={{ cursor: "default" }}>
              No matching notes.
            </div>
          }
        >
          {(c) => (
            <label class={item}>
              <input
                type="checkbox"
                checked={picked().has(c.id)}
                onChange={() => toggle(c.id)}
              />
              <span class={titleCls}>{c.title}</span>
              <Show when={c.collectionName}>
                {(name) => <span class={meta}>in {name()}</span>}
              </Show>
              <Show when={!c.collectionName && c.path}>
                {(p) => <span class={meta}>{p()}</span>}
              </Show>
            </label>
          )}
        </For>
      </div>
      <Show when={all().some((c) => picked().has(c.id) && c.collectionName)}>
        <p class={note}>
          Notes already in another collection move here. Values carry over where
          property names match.
        </p>
      </Show>
    </SimpleDialog>
  );
};
