import { A, useSearchParams } from "@solidjs/router";
import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  onMount,
} from "solid-js";
import { rememberTimeZone } from "~/lib/collections/timezone";
import { css } from "styled-system/css";
import type { CollectionBundle } from "~/lib/collections/types";
import { CollectionProvider } from "./CollectionContext";
import { CollectionTitle } from "./CollectionTitle";
import { CollectionActions } from "./membership/CollectionActions";
import { CollectionViewHost } from "./CollectionViewHost";
import { RowPeekPanel } from "./RowPeekPanel";
import { createCollectionStore } from "./store/createCollectionStore";
import { ViewTabs } from "./views/ViewTabs";

const page = css({
  display: "flex",
  flexDirection: "column",
  gap: "2",
  minH: "0",
  // Header actions and the title size follow this width (CollectionActions).
  containerType: "inline-size",
  containerName: "colpage",
});
const breadcrumb = css({
  fontSize: "xs",
  color: "fg.muted",
  "& a": { _hover: { color: "fg.default" } },
});
const headerRow = css({
  display: "flex",
  alignItems: "center",
  gap: "3",
  minW: "0",
  "@container colpage (max-width: 35rem)": { gap: "2" },
});
const count = css({
  flexShrink: "0",
  fontSize: "sm",
  color: "fg.subtle",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
});

/** A collection's own page: name, view tabs, the active view, and the row peek. */
export const CollectionPage = (props: { bundle: CollectionBundle }) => {
  const store = createCollectionStore(() => props.bundle);
  const [params, setParams] = useSearchParams();
  const [renaming, setRenaming] = createSignal(false);
  onMount(rememberTimeZone);

  const activeView = createMemo(() => {
    const views = store.state.views;
    return views.find((v) => v.id === params.view) ?? views[0];
  });
  // Row ids the active view shows, in its order after filter, sort and
  // search: the header count and the panel's Previous/Next.
  const shownIds = createMemo(() => {
    const view = activeView();
    if (!view) return store.state.rows.map((r) => r.id);
    return store.viewRows(store.view(view.id) ?? view).map((r) => r.id);
  });
  const shownCount = () => shownIds().length;
  // The open record lives in `?row=` so a link or reload reopens it. Opening
  // pushes history, so Back closes the panel; moving between rows replaces.
  const rowParam = () => {
    const row = params.row;
    return (Array.isArray(row) ? row[0] : row) || null;
  };
  let pushed = false;
  createEffect(() => {
    if (!rowParam()) pushed = false;
  });
  const openRow = (id: string) => {
    if (id === rowParam()) return;
    const replace = Boolean(rowParam());
    if (!replace) pushed = true;
    setParams({ row: id }, { replace, scroll: false });
  };
  const closeRow = () => {
    if (!rowParam()) return;
    if (pushed) {
      pushed = false;
      history.back();
      return;
    }
    setParams({ row: undefined }, { replace: true, scroll: false });
  };

  const countLabel = () => {
    const total = store.state.rows.length;
    if (shownCount() !== total) return `${shownCount()} of ${total}`;
    return `${total} ${total === 1 ? "row" : "rows"}`;
  };

  return (
    <CollectionProvider store={store} openRow={openRow} embedded={false}>
      <div class={page}>
        <div class={breadcrumb}>
          <A href="/collections">Collections</A>
        </div>
        <div class={headerRow}>
          <CollectionTitle
            name={store.state.collection.name}
            icon={store.state.collection.icon}
            onRename={(name) => void store.renameCollection(name)}
            editing={renaming()}
            setEditing={setRenaming}
          />
          <span class={count} data-row-count>
            {countLabel()}
          </span>
          <CollectionActions onRename={() => setRenaming(true)} />
        </div>
        <ViewTabs
          activeViewId={activeView()?.id}
          onSelect={(id) => setParams({ view: id })}
        />
        <Show when={activeView()} keyed>
          {(view) => <CollectionViewHost view={store.view(view.id) ?? view} />}
        </Show>
      </div>
      <RowPeekPanel
        rowId={rowParam()}
        onClose={closeRow}
        onMove={openRow}
        routed
        order={shownIds}
      />
    </CollectionProvider>
  );
};
