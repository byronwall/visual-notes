import { Match, Switch } from "solid-js";
import { css } from "styled-system/css";
import type { CollectionView } from "~/lib/collections/types";
import { useCollection } from "./CollectionContext";
import { CollectionTable } from "./table/CollectionTable";
import { CollectionToolbar } from "./views/CollectionToolbar";
import { CollectionBoard } from "./board/CollectionBoard";
import { CardFieldsSettings, GroupBySettings } from "./views/ViewSettings";

const stack = css({ display: "flex", flexDirection: "column", gap: "2" });

/** Toolbar plus the view body, by type. Shared by collection pages and note embeds. */
export const CollectionViewHost = (props: { view: CollectionView }) => {
  const { store, openRow } = useCollection();
  const addAndOpen = async () => {
    const row = await store.addRow();
    if (row) openRow(row.id);
  };
  return (
    <div class={stack}>
      <CollectionToolbar
        view={props.view}
        onNew={() => void addAndOpen()}
        settings={
          <Switch>
            <Match when={props.view.type === "board"}>
              <GroupBySettings view={props.view} />
              <CardFieldsSettings
                view={props.view}
                exclude={props.view.config.groupBy}
              />
            </Match>
          </Switch>
        }
      />
      <Switch fallback={<CollectionTable view={props.view} />}>
        <Match when={props.view.type === "table"}>
          <CollectionTable view={props.view} />
        </Match>
        <Match when={props.view.type === "board"}>
          <CollectionBoard view={props.view} />
        </Match>
      </Switch>
    </div>
  );
};
