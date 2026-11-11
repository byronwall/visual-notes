import { Show, createSignal, onCleanup, onMount } from "solid-js";
import { css } from "styled-system/css";
import type { CollectionView } from "~/lib/collections/types";
import { CollectionTable } from "../table/CollectionTable";
import { CollectionList } from "./CollectionList";
import { LIST_MAX_WIDTH, type ListModeState } from "./useListMode";

const NARROW = "@container colbody (max-width: 639.98px)";

const frame = css({
  containerType: "inline-size",
  containerName: "colbody",
  minW: "0",
});
const listPane = css({ display: "none", [NARROW]: { display: "block" } });
const tablePaneListMode = css({ [NARROW]: { display: "none" } });

/**
 * A table view: the record list in a narrow container (unless the user chose
 * Table there), the table otherwise.
 *
 * The server cannot know the container width. So the first render, on the
 * server and at hydration, mounts both and a container query shows one; the
 * user's choice comes from a cookie, so it matches too. After mount the hidden
 * one is dropped. It is display: none, so nothing on screen moves.
 */
export const TableOrList = (props: {
  view: CollectionView;
  state: ListModeState;
  addRef?: (add: () => void) => void;
}) => {
  let frameEl: HTMLDivElement | undefined;
  const [narrow, setNarrow] = createSignal<boolean | null>(null);
  onMount(() => {
    const measure = () => setNarrow(frameEl!.clientWidth < LIST_MAX_WIDTH);
    const observer = new ResizeObserver(measure);
    observer.observe(frameEl!);
    measure();
    onCleanup(() => observer.disconnect());
  });
  const listMode = () => props.state.mode() === "list";
  const showList = () => listMode() && narrow() !== false;
  const showTable = () => !listMode() || narrow() !== true;

  let addList: (() => void) | undefined;
  let addTable: (() => void) | undefined;
  props.addRef?.(() => (listMode() && narrow() ? addList : addTable)?.());

  return (
    <div ref={frameEl} class={frame}>
      <Show when={showList()}>
        <div class={listPane}>
          <CollectionList view={props.view} addRef={(a) => (addList = a)} />
        </div>
      </Show>
      <Show when={showTable()}>
        <div class={listMode() ? tablePaneListMode : undefined}>
          <CollectionTable view={props.view} addRef={(a) => (addTable = a)} />
        </div>
      </Show>
    </div>
  );
};
