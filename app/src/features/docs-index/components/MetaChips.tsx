import { For, Show } from "solid-js";
import { getTopMetaEntries } from "../utils/meta";

export const MetaChips = (props: {
  meta?: Record<string, unknown> | null;
  onClick?: (k: string, v: string) => void;
}) => {
  return (
    <Show when={props.meta}>
      <For each={getTopMetaEntries(props.meta as any)}>
        {(entry) => (
          <button
            type="button"
            class="text-xs px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100"
            onClick={() => props.onClick?.(entry[0], entry[1])}
            title={`Filter by ${entry[0]}=${entry[1]}`}
          >
            {entry[0]}: {entry[1]}
          </button>
        )}
      </For>
    </Show>
  );
};


