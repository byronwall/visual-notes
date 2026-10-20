import { A, useSearchParams } from "@solidjs/router";
import { Show, createMemo, createSignal, onMount } from "solid-js";
import { rememberTimeZone } from "~/lib/collections/timezone";
import { css } from "styled-system/css";
import type { CollectionBundle } from "~/lib/collections/types";
import { CollectionProvider } from "./CollectionContext";
import { CollectionTitle } from "./CollectionTitle";
import { CollectionViewHost } from "./CollectionViewHost";
import { RowPeekPanel } from "./RowPeekPanel";
import { createCollectionStore } from "./store/createCollectionStore";
import { ViewTabs } from "./views/ViewTabs";

const page = css({
  display: "flex",
  flexDirection: "column",
  gap: "3",
  minH: "0",
});
const breadcrumb = css({
  fontSize: "xs",
  color: "fg.muted",
  "& a": { _hover: { color: "fg.default" } },
});
const headerRow = css({
  display: "flex",
  alignItems: "baseline",
  gap: "3",
  flexWrap: "wrap",
});
const count = css({ fontSize: "sm", color: "fg.subtle" });

/** A collection's own page: name, view tabs, the active view, and the row peek. */
export const CollectionPage = (props: { bundle: CollectionBundle }) => {
  const store = createCollectionStore(() => props.bundle);
  const [params, setParams] = useSearchParams();
  const [peekRowId, setPeekRowId] = createSignal<string | null>(null);
  onMount(rememberTimeZone);

  const activeView = createMemo(() => {
    const views = store.state.views;
    return views.find((v) => v.id === params.view) ?? views[0];
  });

  return (
    <CollectionProvider store={store} openRow={setPeekRowId} embedded={false}>
      <div class={page}>
        <div class={breadcrumb}>
          <A href="/collections">Collections</A>
        </div>
        <div class={headerRow}>
          <CollectionTitle
            name={store.state.collection.name}
            icon={store.state.collection.icon}
            onRename={(name) => void store.renameCollection(name)}
          />
          <span class={count}>
            {store.state.rows.length}{" "}
            {store.state.rows.length === 1 ? "row" : "rows"}
          </span>
        </div>
        <ViewTabs
          activeViewId={activeView()?.id}
          onSelect={(id) => setParams({ view: id })}
        />
        <Show when={activeView()} keyed>
          {(view) => <CollectionViewHost view={store.view(view.id) ?? view} />}
        </Show>
      </div>
      <RowPeekPanel rowId={peekRowId()} onClose={() => setPeekRowId(null)} />
    </CollectionProvider>
  );
};
