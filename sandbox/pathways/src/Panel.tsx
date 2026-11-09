import { createEffect, createMemo, on, Show } from "solid-js";
import { ChangeCard } from "./ChangeCard";
import { NodePanel } from "./NodePanel";
import { OverviewPanel } from "./OverviewPanel";
import { map, selected, setSteer } from "./state";

export function Panel() {
  const node = createMemo(() => map()?.nodes.find((n) => n.id === selected()) ?? null);
  // Steer text is about what was selected when you typed it.
  createEffect(on(selected, () => setSteer(""), { defer: true }));

  return (
    <aside class="panel">
      <ChangeCard />
      <Show when={node()} fallback={<OverviewPanel />}>
        {(n) => <NodePanel n={n()} />}
      </Show>
    </aside>
  );
}
