import { createResource, createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import type { PathwayActivity } from "~/server/pathways/pathway-store";
import { fetchPathwayActivity } from "~/services/pathways/pathways.queries";
import { forgetQuery } from "~/features/live-sync/forget-query";
import { onDemand } from "~/utils/kept-async";
import { ACTION_LABEL, usePathway } from "./pathway-state";
import { help, textButton } from "./styles";

const list = css({
  listStyle: "none",
  m: "0",
  p: "3",
  display: "flex",
  flexDirection: "column",
});
// One row per change, on a thin rail with a dot per author.
const item = css({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: "0.5",
  pl: "5",
  pb: "3",
  fontSize: "xs",
  _before: {
    content: '""',
    position: "absolute",
    left: "1",
    top: "1.5",
    bottom: "-1",
    w: "1px",
    bg: "gray.a5",
  },
  _last: { _before: { display: "none" } },
});
const dot = css({
  position: "absolute",
  left: "0",
  top: "1",
  w: "2.5",
  h: "2.5",
  borderRadius: "full",
  borderWidth: "2px",
  bg: "bg.default",
  "&[data-who=you]": { borderColor: "gray.9" },
  "&[data-who=agent]": { borderColor: "blue.9", bg: "blue.9" },
  "&[data-who=mcp]": { borderColor: "fg.default", bg: "fg.default" },
});
const head = css({ display: "flex", alignItems: "baseline", gap: "2" });
const who = css({ fontWeight: "semibold", fontSize: "sm" });
const when = css({ ml: "auto", color: "fg.muted", whiteSpace: "nowrap" });

const AGENT_RUN: Record<string, string> = {
  ...ACTION_LABEL,
  "fresh map": ACTION_LABEL.regenerate,
  research: "Research",
};

/** Who made a change and which action, from the revision label. */
function describe(label: string) {
  if (label.startsWith("agent: ")) {
    const run = label.slice(7);
    return { who: "agent", name: "Agent", what: AGENT_RUN[run] ?? run };
  }
  if (label.startsWith("mcp: "))
    return { who: "mcp", name: "Outside agent", what: label.slice(5) };
  return { who: "you", name: "You", what: "" };
}

const time = (d: Date) => {
  const at = new Date(d);
  const today = new Date().toDateString() === at.toDateString();
  return at.toLocaleString(undefined, {
    ...(today ? {} : { month: "short", day: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
};

/**
 * Activity: every change to the map, yours and the agents', newest first.
 * Reads the revision history that Undo uses.
 */
export function ActivityPanel() {
  const s = usePathway();
  // Refetches whenever the map changes, so a new run shows at the top.
  // Forget the cached list first: the router reuses a read from the last 5s.
  const [rows] = createResource(
    () => ({ id: s.record().id, at: String(s.record().updatedAt) }),
    (k) =>
      forgetQuery(["pathway-activity"]).then(() => fetchPathwayActivity(k.id)),
    onDemand,
  );
  return (
    <Show
      when={rows.latest}
      fallback={
        <p class={help} style={{ padding: "12px" }}>
          Loading…
        </p>
      }
    >
      {(r) => (
        <Show
          when={r().length}
          fallback={
            <p class={help} style={{ padding: "12px" }}>
              No changes yet. Edits and agent runs show here.
            </p>
          }
        >
          <ol class={list}>
            <For each={r()}>{(a) => <Row a={a} />}</For>
          </ol>
        </Show>
      )}
    </Show>
  );
}

function Row(props: { a: PathwayActivity }) {
  const d = () => describe(props.a.label);
  const parts = () =>
    [
      props.a.linked && `${props.a.linked} linked`,
      props.a.unlinked && `${props.a.unlinked} unlinked`,
      props.a.goals && "goals",
      props.a.plan && "next steps",
    ].filter(Boolean);
  return (
    <li class={item}>
      <span class={dot} data-who={d().who} />
      <div class={head}>
        <span class={who}>{d().name}</span>
        <Show when={d().what}>
          <span>{d().what}</span>
        </Show>
        <span class={when}>{time(props.a.at)}</span>
      </div>
      <Titles verb="Added" titles={props.a.added} />
      <Titles verb="Removed" titles={props.a.removed} />
      <Titles verb="Changed" titles={props.a.edited} />
      <Show when={parts().length}>
        <span class={help}>Also: {parts().join(" · ")}</span>
      </Show>
    </li>
  );
}

/** A verb and the card titles it touched, the first few with a toggle for the rest. */
function Titles(props: { verb: string; titles: string[] }) {
  const [all, setAll] = createSignal(false);
  const shown = () => (all() ? props.titles : props.titles.slice(0, 4));
  return (
    <Show when={props.titles.length}>
      <div class={css({ color: "fg.muted", lineHeight: "1.5" })}>
        {props.verb} {props.titles.length}:{" "}
        <span class={css({ color: "fg.default" })}>{shown().join(" · ")}</span>
        <Show when={props.titles.length > 4}>
          {" "}
          <button class={textButton} onClick={() => setAll((v) => !v)}>
            {all() ? "less" : `+${props.titles.length - 4} more`}
          </button>
        </Show>
      </div>
    </Show>
  );
}
