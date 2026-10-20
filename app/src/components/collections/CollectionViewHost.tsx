import { Match, Switch } from "solid-js";
import type { CollectionView } from "~/lib/collections/types";
import { CollectionTable } from "./table/CollectionTable";

/** Renders one view by type. Shared by collection pages and note embeds. */
export const CollectionViewHost = (props: { view: CollectionView }) => (
  <Switch fallback={<CollectionTable view={props.view} />}>
    <Match when={props.view.type === "table"}>
      <CollectionTable view={props.view} />
    </Match>
  </Switch>
);
