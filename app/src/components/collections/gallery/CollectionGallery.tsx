import { ImageIcon, PlusIcon } from "lucide-solid";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { applyView, orderedProperties } from "~/lib/collections/query";
import type { CollectionRow, CollectionView } from "~/lib/collections/types";
import { fetchNoteSummaries } from "~/services/collections/collections.queries";
import { CardFields } from "../board/CardFields";
import { useCollection } from "../CollectionContext";

const PAGE = 60;

const grid = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))",
  gap: "3",
});
const card = css({
  display: "flex",
  flexDirection: "column",
  borderRadius: "l3",
  borderWidth: "1px",
  borderColor: "border",
  bg: "bg.default",
  overflow: "hidden",
  cursor: "pointer",
  textAlign: "left",
  transition: "border-color 120ms, box-shadow 120ms",
  _hover: { borderColor: "border.emphasized", boxShadow: "sm" },
  _focusVisible: {
    outline: "2px solid token(colors.border.accent)",
    outlineOffset: "2px",
  },
});
const cover = css({
  aspectRatio: "16 / 10",
  bg: "bg.subtle",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "fg.subtle",
  overflow: "hidden",
  borderBottomWidth: "1px",
  borderColor: "border",
  "& img": { w: "full", h: "full", objectFit: "cover" },
});
const body = css({
  display: "flex",
  flexDirection: "column",
  gap: "1.5",
  p: "3",
  minW: "0",
});
const title = css({
  fontSize: "sm",
  fontWeight: "semibold",
  lineHeight: "1.35",
  wordBreak: "break-word",
});
const preview = css({
  fontSize: "xs",
  color: "fg.muted",
  lineHeight: "1.45",
  lineClamp: "3",
});
const newCard = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5",
  minH: "24",
  borderRadius: "l3",
  borderWidth: "1px",
  borderStyle: "dashed",
  borderColor: "border",
  color: "fg.subtle",
  fontSize: "sm",
  cursor: "pointer",
  _hover: { color: "fg.default", borderColor: "border.emphasized" },
});
const more = css({
  gridColumn: "1 / -1",
  h: "9",
  borderRadius: "l2",
  color: "fg.muted",
  fontSize: "sm",
  cursor: "pointer",
  _hover: { bg: "bg.muted" },
});

/** Cards with a cover (first body image or a URL property), fields, and a body preview. */
export const CollectionGallery = (props: { view: CollectionView }) => {
  const { store, openRow } = useCollection();
  const [limit, setLimit] = createSignal(PAGE);
  const [summaries] = createResource(
    () => ({ id: store.state.collection.id, v: store.contentVersion() }),
    ({ id }) => fetchNoteSummaries(id),
  );
  const coverSource = () => props.view.config.cover?.source ?? "body";
  const coverProperty = () =>
    store.state.properties.find(
      (p) => p.id === props.view.config.cover?.propertyId,
    );
  const cardProperties = createMemo(() => {
    const chosen = props.view.config.cardProperties;
    const all = orderedProperties(store.state.properties, props.view.config, {
      includeHidden: true,
    });
    return chosen ? all.filter((p) => chosen.includes(p.id)) : all.slice(0, 2);
  });
  const rows = createMemo(() =>
    applyView(
      store.state.rows,
      store.state.properties,
      store.effectiveConfig(props.view),
      store.state.today,
    ),
  );

  const coverFor = (row: CollectionRow): string | null => {
    if (coverSource() === "none") return null;
    if (coverSource() === "property") {
      const p = coverProperty();
      const v = p ? row.properties[p.id] : null;
      return typeof v === "string" && /^(https?:|data:image\/)/i.test(v)
        ? v
        : null;
    }
    return summaries.latest?.[row.id]?.coverUrl ?? null;
  };

  const addRow = async () => {
    const row = await store.addRow();
    if (row) openRow(row.id);
  };

  return (
    <div class={grid}>
      <For each={rows().slice(0, limit())}>
        {(row) => (
          <div
            class={card}
            role="button"
            tabIndex={0}
            onClick={() => openRow(row.id)}
            onKeyDown={(e) =>
              (e.key === "Enter" || e.key === " ") &&
              (e.preventDefault(), openRow(row.id))
            }
          >
            <Show when={coverSource() !== "none"}>
              <div class={cover}>
                <Show when={coverFor(row)} fallback={<ImageIcon size={20} />}>
                  {(src) => <img src={src()} alt="" loading="lazy" />}
                </Show>
              </div>
            </Show>
            <div class={body}>
              <span class={title}>{row.title || "Untitled"}</span>
              <CardFields row={row} properties={cardProperties()} />
              <Show when={summaries.latest?.[row.id]?.preview}>
                {(text) => <p class={preview}>{text()}</p>}
              </Show>
            </div>
          </div>
        )}
      </For>
      <button type="button" class={newCard} onClick={() => void addRow()}>
        <PlusIcon size={14} /> New
      </button>
      <Show when={rows().length > limit()}>
        <button
          type="button"
          class={more}
          onClick={() => setLimit((n) => n + PAGE)}
        >
          Show {Math.min(PAGE, rows().length - limit())} more of {rows().length}
        </button>
      </Show>
    </div>
  );
};
