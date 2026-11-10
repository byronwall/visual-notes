import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { usePathway } from "./pathway-state";
import { cardLink, iconX, linkList, row } from "./styles";

/** Links to cards, each selecting its card; optional × removes the connection. */
export function EdgeList(props: {
  ids: string[];
  title: (id: string) => string;
  onRemove?: (id: string) => void;
  count?: (id: string) => string;
}) {
  const s = usePathway();
  return (
    <ul class={linkList}>
      <For each={props.ids}>
        {(id) => (
          <li class={row}>
            <button
              class={cardLink}
              style={{ flex: "1" }}
              onClick={() => s.setSelected(id)}
            >
              {props.title(id)}
            </button>
            <Show when={props.count}>
              <span
                class={css({
                  fontSize: "xs",
                  fontWeight: "semibold",
                  color: "amber.11",
                })}
              >
                {props.count!(id)}
              </span>
            </Show>
            <Show when={props.onRemove}>
              <button
                class={iconX}
                title="Remove this connection"
                onClick={() => props.onRemove!(id)}
              >
                ×
              </button>
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
}
