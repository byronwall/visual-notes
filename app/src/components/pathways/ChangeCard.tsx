import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { EdgeList } from "./NodePanel";
import { usePathway } from "./pathway-state";
import { help, iconX, label, row } from "./styles";

const card = css({
  display: "flex",
  flexDirection: "column",
  gap: "1.5",
  p: "3",
  borderBottomWidth: "1px",
  borderColor: "border",
  borderLeftWidth: "4px",
  borderLeftColor: "blue.9",
  bg: "blue.2",
});

/** "What changed" after an agent run, at the top of the side panel. */
export function ChangeCard() {
  const s = usePathway();
  const title = (id: string) =>
    s.record().graph.nodes.find((n) => n.id === id)?.title ?? id;

  return (
    <Show when={s.change()}>
      {(c) => (
        <div class={card}>
          <div class={row}>
            <strong
              class={css({
                flex: "1",
                minW: "0",
                truncate: true,
                fontSize: "sm",
              })}
            >
              ✦ {c().label}
            </strong>
            <Show when={c().ms}>
              <span class={help}>{(c().ms! / 1000).toFixed(1)}s</span>
            </Show>
            <button
              class={iconX}
              title="Clear the highlights"
              onClick={() => s.setChange(null)}
            >
              ×
            </button>
          </div>
          <Show when={c().summary}>
            <p class={css({ m: "0", fontSize: "sm" })}>{c().summary}</p>
          </Show>
          <Show when={c().steer}>
            <p class={help}>Steered by: “{c().steer}”</p>
          </Show>
          <Show
            when={
              c().added.length ||
              c().joined.length ||
              c().removed.length ||
              c().dropped?.length ||
              c().questions ||
              c().planned
            }
            fallback={<p class={help}>Nothing on the map changed.</p>}
          >
            <Show when={c().added.length}>
              <span class={label}>Added {c().added.length}</span>
              <EdgeList ids={c().added} title={title} />
            </Show>
            <Show when={c().joined.length}>
              <span class={label}>Joined existing paths</span>
              <EdgeList ids={c().joined} title={title} />
            </Show>
            <Show when={c().dropped?.length}>
              <span class={label}>Marked dropped</span>
              <EdgeList ids={c().dropped!} title={title} />
            </Show>
            <Show when={c().removed.length}>
              <span class={label}>Merged away</span>
              <For each={c().removed}>{(t) => <p class={help}>{t}</p>}</For>
            </Show>
            <Show when={c().questions}>
              <p class={help}>
                {c().questions} new questions under Goals &amp; vibes. Answer
                them, then ask again.
              </p>
            </Show>
            <Show when={c().planned}>
              <p class={help}>
                {c().planned} next steps are ready in Next steps.
              </p>
            </Show>
          </Show>
        </div>
      )}
    </Show>
  );
}
