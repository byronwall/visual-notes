import { createMemo, Show } from "solid-js";
import { css } from "styled-system/css";
import { ChangeCard } from "./ChangeCard";
import { NodePanel } from "./NodePanel";
import { OverviewPanel } from "./OverviewPanel";
import { usePathway } from "./pathway-state";

const panel = css({
  w: "340px",
  flex: "none",
  overflowY: "auto",
  borderLeftWidth: "1px",
  borderColor: "border",
  bg: "bg.default",
});

/** The side panel: the selected card, or the whole map when nothing is selected. */
export function PathwayPanel() {
  const s = usePathway();
  const node = createMemo(
    () => s.record().graph.nodes.find((n) => n.id === s.selected()) ?? null,
  );
  return (
    <aside class={panel}>
      <ChangeCard />
      <Show when={node()} fallback={<OverviewPanel />}>
        {(n) => <NodePanel n={n()} />}
      </Show>
    </aside>
  );
}
