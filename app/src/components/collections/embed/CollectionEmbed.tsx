import { A } from "@solidjs/router";
import {
  ArrowUpRightIcon,
  DatabaseIcon,
  GripVerticalIcon,
  Trash2Icon,
} from "lucide-solid";
import { Dynamic } from "solid-js/web";
import { Show, createResource, createSignal } from "solid-js";
import { css } from "styled-system/css";
import type { CollectionBundle } from "~/lib/collections/types";
import { fetchCollectionViewBundle } from "~/services/collections/collections.queries";
import { CollectionProvider } from "../CollectionContext";
import { CollectionViewHost } from "../CollectionViewHost";
import { RowPeekPanel } from "../RowPeekPanel";
import { createCollectionStore } from "../store/createCollectionStore";
import { VIEW_ICONS } from "../views/ViewTabs";
import { EmbedPicker } from "./EmbedPicker";

const frame = css({
  display: "flex",
  flexDirection: "column",
  gap: "2",
  fontFamily: "sans",
  // Undo prose typography so the embed looks like the collection page.
  "& :where(h1,h2,h3,p,ul,ol)": { margin: "0" },
});
const header = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  minH: "8",
  fontSize: "sm",
  color: "fg.muted",
  "& [data-embed-actions]": { opacity: "0", transition: "opacity 120ms" },
  "&:hover [data-embed-actions], &:focus-within [data-embed-actions]": {
    opacity: "1",
  },
});
const title = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  fontWeight: "semibold",
  fontSize: "md",
  // Beat the note's prose link styles.
  color: "fg.default !important",
  textDecoration: "none !important",
  _hover: { textDecoration: "underline !important" },
});
const viewName = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  fontSize: "xs",
  color: "fg.subtle",
});
const actions = css({
  ml: "auto",
  display: "inline-flex",
  gap: "1",
  alignItems: "center",
});
const iconBtn = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  h: "7",
  px: "1.5",
  borderRadius: "l1",
  color: "fg.muted !important",
  fontSize: "xs",
  cursor: "pointer",
  textDecoration: "none !important",
  _hover: { bg: "bg.muted", color: "fg.default !important" },
});
const handle = css({
  display: "inline-flex",
  color: "fg.subtle",
  cursor: "grab",
});
const missing = css({
  p: "3",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  color: "fg.muted",
  fontSize: "sm",
  display: "flex",
  alignItems: "center",
  gap: "2",
});

const LoadedEmbed = (props: {
  bundle: CollectionBundle;
  viewId: string;
  editable: boolean;
  onRemove: () => void;
}) => {
  const store = createCollectionStore(() => props.bundle);
  const [peekRowId, setPeekRowId] = createSignal<string | null>(null);
  const view = () => store.view(props.viewId);
  return (
    <CollectionProvider store={store} openRow={setPeekRowId} embedded>
      <div class={header}>
        <span
          class={handle}
          data-drag-handle
          draggable="true"
          aria-label="Drag to move"
        >
          <GripVerticalIcon size={14} />
        </span>
        <A class={title} href={`/collections/${store.state.collection.id}`}>
          <Show
            when={store.state.collection.icon}
            fallback={<DatabaseIcon size={15} />}
          >
            <span>{store.state.collection.icon}</span>
          </Show>
          {store.state.collection.name}
        </A>
        <Show when={view()}>
          {(v) => (
            <span class={viewName}>
              <Dynamic component={VIEW_ICONS[v().type]} size={12} />
              {v().name}
            </span>
          )}
        </Show>
        <span class={actions} data-embed-actions>
          <A
            class={iconBtn}
            href={`/collections/${store.state.collection.id}`}
            aria-label="Open collection"
          >
            <ArrowUpRightIcon size={13} /> Open
          </A>
          <Show when={props.editable}>
            <button
              type="button"
              class={iconBtn}
              aria-label="Remove embed"
              onClick={() => props.onRemove()}
            >
              <Trash2Icon size={13} />
            </button>
          </Show>
        </span>
      </div>
      <Show when={view()}>{(v) => <CollectionViewHost view={v()} />}</Show>
      <RowPeekPanel rowId={peekRowId()} onClose={() => setPeekRowId(null)} />
    </CollectionProvider>
  );
};

/**
 * Body of a /collection block in a note. Client-only: it lives inside the
 * editor's node view, which never renders on the server.
 */
export const CollectionEmbed = (props: {
  viewId: string | null;
  hostDocId?: string;
  editable: boolean;
  onPick: (viewId: string) => void;
  onRemove: () => void;
}) => {
  const [bundle] = createResource(
    () => props.viewId,
    (viewId) => fetchCollectionViewBundle(viewId),
  );
  return (
    <div class={frame} data-collection-embed="">
      <Show
        when={props.viewId}
        fallback={
          <Show when={props.editable}>
            <EmbedPicker
              hostDocId={props.hostDocId}
              onPick={props.onPick}
              onRemove={props.onRemove}
            />
          </Show>
        }
      >
        {(viewId) => (
          <Show
            when={bundle.latest}
            fallback={
              <Show
                when={bundle.state === "ready" || bundle.state === "errored"}
                fallback={<div class={missing}>Loading collection…</div>}
              >
                <div class={missing}>
                  <DatabaseIcon size={14} /> This collection view no longer
                  exists.
                </div>
              </Show>
            }
          >
            {(b) => (
              <LoadedEmbed
                bundle={b()}
                viewId={viewId()}
                editable={props.editable}
                onRemove={props.onRemove}
              />
            )}
          </Show>
        )}
      </Show>
    </div>
  );
};
