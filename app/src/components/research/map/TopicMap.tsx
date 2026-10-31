import { onCleanup, onMount } from "solid-js";
import { css } from "styled-system/css";
import type { TopicData } from "../createTopicData";
import { createMapState } from "./createMapState";
import { MapCanvas } from "./MapCanvas";
import { MapHeaderTree } from "./MapHeaderTree";

/**
 * A topic's first view: titles and counts only, with card text left to the
 * reader. The canvas and the phone tree both stay mounted and CSS picks one,
 * so the server render matches at any width.
 */
export const TopicMap = (props: {
  data: TopicData;
  selectedId: string | null;
  selectedStream: string | null;
  matches: Set<string> | null;
  query: string;
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
  onSelectStream: (key: string) => void;
}) => {
  const state = createMapState({
    data: () => props.data,
    selectedId: () => props.selectedId,
    selectedStream: () => props.selectedStream,
    matches: () => props.matches,
  });

  // "/" reaches the search here too; the rail's own field may be hidden.
  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      if (
        (event.target as HTMLElement | null)?.closest(
          "input, textarea, [contenteditable=true]",
        )
      )
        return;
      const fields =
        document.querySelectorAll<HTMLInputElement>("[data-map-search]");
      [...fields].find((field) => field.offsetParent)?.focus();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
    <>
      <div class={css({ display: { base: "none", md: "block" }, h: "full" })}>
        <MapCanvas
          state={state}
          query={props.query}
          onQuery={props.onQuery}
          onSelect={props.onSelect}
          onSelectStream={props.onSelectStream}
        />
      </div>
      <div class={css({ display: { base: "block", md: "none" }, h: "full" })}>
        <MapHeaderTree
          state={state}
          query={props.query}
          onQuery={props.onQuery}
          onSelect={props.onSelect}
        />
      </div>
    </>
  );
};
