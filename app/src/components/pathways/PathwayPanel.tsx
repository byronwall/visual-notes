import { createMemo, For, Match, Switch } from "solid-js";
import { css } from "styled-system/css";
import { ActivityPanel } from "./ActivityPanel";
import { NextSteps } from "./NextSteps";
import { NodePanel } from "./NodePanel";
import { OverviewPanel } from "./OverviewPanel";
import { usePathway, type PanelTab } from "./pathway-state";

const panel = css({
  w: "380px",
  flex: "none",
  display: "flex",
  flexDirection: "column",
  minH: "0",
  borderLeftWidth: "1px",
  borderColor: "border",
  bg: "bg.default",
});
const tabs = css({
  display: "flex",
  gap: "4",
  px: "3",
  flex: "none",
  borderBottomWidth: "1px",
  borderColor: "border",
  "& > button": {
    h: "9",
    p: "0",
    border: "none",
    // The active tab's underline sits on the bar's own border, so nothing moves.
    borderBottom: "2px solid transparent",
    mb: "-1px",
    bg: "transparent",
    fontSize: "sm",
    color: "fg.muted",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "color 140ms, border-color 140ms",
    _hover: { color: "fg.default" },
  },
  "& > button[aria-selected=true]": {
    color: "fg.default",
    fontWeight: "semibold",
    borderBottomColor: "fg.default",
  },
});
const scroll = css({ flex: "1", minH: "0", overflowY: "auto" });

/**
 * The side panel beside the map: the selected card (or the whole map when
 * nothing is selected), Next steps, or Activity. The map stays in view, so a
 * step's cards light up on the map as you work through the list.
 */
export function PathwayPanel() {
  const s = usePathway();
  const node = createMemo(
    () => s.record().graph.nodes.find((n) => n.id === s.selected()) ?? null,
  );
  const openTasks = () =>
    s.record().plan?.tasks.filter((t) => t.status === "todo").length ?? 0;
  const list: { tab: PanelTab; label: () => string }[] = [
    { tab: "map", label: () => (node() ? "Card" : "Overview") },
    {
      tab: "next",
      label: () => `Next steps${openTasks() ? ` (${openTasks()})` : ""}`,
    },
    { tab: "activity", label: () => "Activity" },
  ];
  return (
    <aside class={panel}>
      <div class={tabs} role="tablist">
        <For each={list}>
          {(t) => (
            <button
              role="tab"
              aria-selected={s.view() === t.tab}
              onClick={() => s.setView(t.tab)}
            >
              {t.label()}
            </button>
          )}
        </For>
      </div>
      <div class={scroll}>
        <Switch>
          <Match when={s.view() === "next"}>
            <NextSteps />
          </Match>
          <Match when={s.view() === "activity"}>
            <ActivityPanel />
          </Match>
          <Match when={node()}>{(n) => <NodePanel n={n()} />}</Match>
          <Match when={true}>
            <OverviewPanel />
          </Match>
        </Switch>
      </div>
    </aside>
  );
}
