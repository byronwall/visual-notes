import { createMemo, createSignal, Show } from "solid-js";
import { ChangeCard } from "./ChangeCard";
import { NodePanel } from "./NodePanel";
import { OverviewPanel } from "./OverviewPanel";
import { map, selected } from "./state";

export function Panel() {
  // One steer box value, shared by the node and whole-map views.
  const [hint, setHint] = createSignal("");
  const node = createMemo(() => map()?.nodes.find((n) => n.id === selected()) ?? null);

  return (
    <aside class="panel">
      <ChangeCard />
      <Show when={node()} fallback={<OverviewPanel hint={hint()} setHint={setHint} />}>
        {(n) => <NodePanel n={n()} hint={hint()} setHint={setHint} />}
      </Show>
    </aside>
  );
}
