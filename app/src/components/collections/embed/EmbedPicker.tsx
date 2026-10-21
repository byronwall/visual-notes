import { useAction } from "@solidjs/router";
import { DatabaseIcon, PlusIcon, XIcon } from "lucide-solid";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { useToasts } from "~/components/Toast";
import {
  createCollection,
  createView,
} from "~/services/collections/collections.actions";
import {
  fetchCollectionBundle,
  fetchCollections,
} from "~/services/collections/collections.queries";
import { noAutofill } from "~/components/ui/no-autofill";

const box = css({
  borderWidth: "1px",
  borderStyle: "dashed",
  borderColor: "border.emphasized",
  borderRadius: "l3",
  p: "3",
  display: "flex",
  flexDirection: "column",
  gap: "2",
  fontSize: "sm",
  bg: "bg.subtle",
});
const head = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "2",
  color: "fg.muted",
});
const search = css({
  h: "8",
  px: "2",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  bg: "bg.default",
  outline: "none",
  fontSize: "sm",
  _focus: { borderColor: "border.accent" },
});
const list = css({
  display: "flex",
  flexDirection: "column",
  maxH: "56",
  overflowY: "auto",
});
const item = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  h: "8",
  px: "2",
  borderRadius: "l2",
  textAlign: "left",
  cursor: "pointer",
  _hover: { bg: "bg.muted" },
});
const meta = css({ ml: "auto", fontSize: "xs", color: "fg.subtle" });
const iconBtn = css({
  display: "inline-flex",
  p: "1",
  borderRadius: "l1",
  cursor: "pointer",
  _hover: { bg: "bg.muted" },
});

/** Shown by a fresh /collection block: choose a collection or make a new one. */
export const EmbedPicker = (props: {
  hostDocId?: string;
  onPick: (viewId: string) => void;
  onRemove: () => void;
}) => {
  const [collections] = createResource(() => fetchCollections());
  const runCreateCollection = useAction(createCollection);
  const runCreateView = useAction(createView);
  const { show } = useToasts();
  const [query, setQuery] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase();
    const all = collections.latest ?? [];
    return q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  });

  const embed = async (collectionId: string) => {
    if (busy()) return;
    setBusy(true);
    try {
      // Copy the collection's first view so the embed starts from familiar settings.
      const bundle = await fetchCollectionBundle(collectionId);
      const base = bundle?.views[0];
      const view = await runCreateView({
        collectionId,
        name: base?.name ?? "Table",
        type: base?.type ?? "table",
        config: base?.config ?? {},
        hostDocId: props.hostDocId ?? null,
      });
      props.onPick(view.id);
    } catch (error) {
      show({
        title: "Couldn't embed the collection",
        message: String((error as Error).message ?? error),
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const createNew = async () => {
    const name = query().trim();
    if (!name || busy()) return;
    try {
      const { id } = await runCreateCollection({ name });
      await embed(id);
    } catch (error) {
      show({
        title: "Couldn't create the collection",
        message: String((error as Error).message ?? error),
        type: "error",
      });
    }
  };

  return (
    <div class={box}>
      <div class={head}>
        <span
          style={{
            display: "inline-flex",
            "align-items": "center",
            gap: "6px",
          }}
        >
          <DatabaseIcon size={14} /> Embed a collection
        </span>
        <button
          type="button"
          class={iconBtn}
          aria-label="Remove block"
          onClick={() => props.onRemove()}
        >
          <XIcon size={14} />
        </button>
      </div>
      <input
        {...noAutofill}
        class={search}
        placeholder="Search collections or type a new name"
        aria-label="Search collections"
        value={query()}
        ref={(el) => queueMicrotask(() => el.focus())}
        onInput={(e) => setQuery(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const first = filtered()[0];
            if (
              first &&
              first.name.toLowerCase() === query().trim().toLowerCase()
            )
              void embed(first.id);
            else void createNew();
          }
        }}
      />
      <div class={list}>
        <For each={filtered()}>
          {(c) => (
            <button
              type="button"
              class={item}
              disabled={busy()}
              onClick={() => void embed(c.id)}
            >
              <Show when={c.icon} fallback={<DatabaseIcon size={14} />}>
                <span>{c.icon}</span>
              </Show>
              {c.name}
              <span class={meta}>{c.rowCount} rows</span>
            </button>
          )}
        </For>
        <Show
          when={
            query().trim() &&
            !filtered().some(
              (c) => c.name.toLowerCase() === query().trim().toLowerCase(),
            )
          }
        >
          <button
            type="button"
            class={item}
            disabled={busy()}
            onClick={() => void createNew()}
          >
            <PlusIcon size={14} /> New collection “{query().trim()}”
          </button>
        </Show>
      </div>
    </div>
  );
};
