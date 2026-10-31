import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { CardTypeIcon } from "../cardTypeMeta";
import type { MapCounts } from "./map-model";
import { metaClass } from "./mapNodeStyles";

/** Open and done counts, then one icon and number per card type. */
export const CountLine = (props: { counts: MapCounts; matches?: number }) => (
  <span class={metaClass}>
    <Show
      when={props.matches === undefined}
      fallback={<span>{props.matches} found</span>}
    >
      <Show when={props.counts.open}>
        <span class={css({ color: "amber.11" })}>{props.counts.open} open</span>
      </Show>
      <Show when={props.counts.done}>
        <span>{props.counts.done} done</span>
      </Show>
    </Show>
    <For each={props.counts.byType}>
      {(entry) => (
        <span
          class={css({
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5",
          })}
        >
          <CardTypeIcon type={entry.type} size={12} />
          {entry.count}
        </span>
      )}
    </For>
  </span>
);
