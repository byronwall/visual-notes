import { A } from "@solidjs/router";
import { DatabaseIcon } from "lucide-solid";
import { Show, Suspense, createResource } from "solid-js";
import { css } from "styled-system/css";
import type { CollectionBundle } from "~/lib/collections/types";
import {
  fetchDocCollection,
  type DocCollectionInfo,
} from "~/services/collections/collections.queries";
import { CollectionProvider } from "./CollectionContext";
import { PropertyList } from "./PropertyList";
import { createCollectionStore } from "./store/createCollectionStore";
import { docCollectionVersion } from "./membership/docCollectionVersion";
import { NoteCollectionMenu } from "./membership/NoteCollectionMenu";

const crumbRow = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  mb: "2",
});
const crumb = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  fontSize: "xs",
  color: "fg.muted",
  textDecoration: "none",
  _hover: { color: "fg.default" },
});

const toBundle = (info: NonNullable<DocCollectionInfo>): CollectionBundle => ({
  collection: info.collection,
  properties: info.properties,
  views: [],
  rows: [info.row],
  today: "",
});

const Header = (props: { info: NonNullable<DocCollectionInfo> }) => {
  const store = createCollectionStore(() => toBundle(props.info));
  const row = () => store.state.rows[0];
  return (
    <CollectionProvider store={store} openRow={() => {}} embedded={false}>
      {/* App chrome inside the note's prose: opt out of prose link styling. */}
      <div class="not-prose">
        <div class={crumbRow}>
          <A href={`/collections/${props.info.collection.id}`} class={crumb}>
            <Show
              when={props.info.collection.icon}
              fallback={<DatabaseIcon size={12} />}
            >
              <span>{props.info.collection.icon}</span>
            </Show>
            {props.info.collection.name}
          </A>
          <NoteCollectionMenu
            docId={props.info.row.id}
            collectionId={props.info.collection.id}
            collectionName={props.info.collection.name}
          />
        </div>
        <Show when={row()}>{(r) => <PropertyList row={r()} />}</Show>
      </div>
    </CollectionProvider>
  );
};

/** On a note page: the note's collection and editable properties, when it has one. */
export const DocCollectionHeader = (props: { docId: string }) => {
  const [info] = createResource(
    () => ({ id: props.docId, v: docCollectionVersion() }),
    ({ id }) => fetchDocCollection(id),
  );
  // Its own boundary so SSR waits for the lookup and hydration sees the same tree.
  return (
    <Suspense>
      <Show when={info()} keyed>
        {(value) => <Header info={value} />}
      </Show>
    </Suspense>
  );
};
