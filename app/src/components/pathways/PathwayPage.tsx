import { A } from "@solidjs/router";
import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { css } from "styled-system/css";
import type { PathwayRecord } from "~/server/pathways/pathway-store";
import { PathwayGraph } from "./PathwayGraph";
import { PathwayPanel } from "./PathwayPanel";
import { createPathwayState, PathwayStateContext } from "./pathway-state";
import { setVote, setWeight, VOTES, WEIGHTS } from "./NodePanel";
import { cardLink, iconX, smallButton } from "./styles";

const page = css({
  display: "flex",
  flexDirection: "column",
  // The app bar sits above this page below md.
  h: { base: "calc(100dvh - 3rem)", md: "100dvh" },
  minH: "0",
  bg: "bg.default",
});
const bar = css({
  display: "flex",
  alignItems: "center",
  gap: "3",
  px: "4",
  py: "2",
  borderBottomWidth: "1px",
  borderColor: "border",
});
const heading = css({
  flex: "1",
  minW: "0",
  m: "0",
  fontSize: "md",
  fontWeight: "semibold",
  truncate: true,
});
const errorBar = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  px: "4",
  py: "1.5",
  fontSize: "sm",
  color: "red.11",
  borderBottomWidth: "1px",
  borderColor: "border",
});
const body = css({ flex: "1", minH: "0", display: "flex" });
const graphSpace = css({ flex: "1", bg: "bg.subtle" });

export function PathwayPage(props: { record: PathwayRecord }) {
  const s = createPathwayState(props.record);
  // A fresher copy from a refetch (agent over MCP, another tab) replaces ours.
  createEffect(
    on(
      () => props.record,
      (r) => s.receive(r),
      { defer: true },
    ),
  );

  // The map measures text on a canvas and routes edges in a Web Worker, so it
  // renders after hydration; the server sends the panel and an empty map area.
  const [mounted, setMounted] = createSignal(false);
  onMount(() => setMounted(true));

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input, textarea, select, [contenteditable]",
        )
      )
        return;
      const node = s.record().graph.nodes.find((n) => n.id === s.selected());
      if (e.key === "Escape")
        return s.linkFrom() ? s.setLinkFrom(null) : s.setSelected(null);
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        return void s.undo();
      }
      if (!node || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") {
        e.preventDefault();
        return s.setTitleFocus((t) => t + 1);
      }
      if (e.key === "Delete" || e.key === "Backspace")
        return s.removeNode(node.id);
      if (node.kind === "root") return;
      const vote = VOTES.find((v) => v.key === e.key);
      const weight = WEIGHTS.find((w) => w.key && w.key === e.key);
      if (vote) setVote(s, node, vote.vote);
      if (weight) setWeight(s, node, weight.weight);
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
    <PathwayStateContext.Provider value={s}>
      <div class={page}>
        <header class={bar}>
          <A class={cardLink} href="/pathways">
            Pathways
          </A>
          <h1 class={heading}>{s.record().title}</h1>
          <Show when={s.linkFrom()}>
            <span
              class={css({
                fontSize: "sm",
                color: "blue.11",
                fontWeight: "semibold",
              })}
            >
              Click the card this leads to · Esc to cancel
            </span>
          </Show>
          <button
            class={smallButton}
            onClick={() => s.undo()}
            title="Undo the last change (⌘Z), including agent changes"
          >
            Undo
          </button>
        </header>
        <Show when={s.error()}>
          <div class={errorBar}>
            <span style={{ flex: "1" }}>{s.error()}</span>
            <button class={iconX} onClick={() => s.setError("")}>
              ×
            </button>
          </div>
        </Show>
        <div class={body}>
          <Show when={mounted()} fallback={<div class={graphSpace} />}>
            <PathwayGraph />
          </Show>
          <PathwayPanel />
        </div>
      </div>
    </PathwayStateContext.Provider>
  );
}
