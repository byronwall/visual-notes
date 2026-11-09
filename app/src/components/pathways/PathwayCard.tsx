import { createMemo, Show } from "solid-js";
import type { PathwayNode } from "~/lib/pathways/types";
import { isFaint } from "./layout";
import { usePathway } from "./pathway-state";
import { fitText } from "./textfit";

const KIND_LABEL = {
  root: "Question",
  option: "Option",
  step: "Step",
  outcome: "Outcome",
};
const VOTE_LABEL = {
  like: "♥ like",
  no: "✕ not for me",
  more: "↻ want better",
};
const RESEARCH_LABEL = {
  suggested: "needs research",
  queued: "queued",
  done: "researched",
};
/** Titles never drop under this many px on screen. */
const MIN_PX = 12;
/** Badges stay at least this many px on screen. */
const BADGE_PX = 10;

export function PathwayCard(props: {
  n: PathwayNode;
  box?: { x: number; y: number; w: number; h: number };
  paths: number;
  lit: boolean;
  /** Zoom, in ~9% steps. */
  k: number;
  far: boolean;
  next?: number;
  onHover: (id: string | null) => void;
}) {
  const s = usePathway();
  const n = () => props.n;
  // Level of detail by zoom. Below full detail the type label and note hide,
  // and the title grows to fill the card (see fitText), in as many lines as
  // the card's fixed height allows. Positions never change with zoom.
  const lod = () => (props.far ? "far" : props.k >= 0.9 ? "full" : "mid");
  const fresh = () => s.freshNodes().has(n().id);
  const fit = createMemo(() => {
    const b = props.box;
    if (!b || lod() === "full") return null;
    const k = props.k;
    const pad = lod() === "far" ? 6 : 8;
    const badges =
      !!props.next ||
      fresh() ||
      props.paths > 1 ||
      !!n().feedback ||
      !!n().research ||
      !!n().missed ||
      n().status === "chosen";
    // Content box: card minus padding and borders (4-6px left rail, 1-2px others), with 3% slack.
    const textW = (b.w - 2 * (pad + 2) - 8) * 0.97;
    // Badges scale with the title (half its size, at least BADGE_PX on screen).
    const solve = (badgeF: number) => {
      const headH = badges ? badgeF * 1.4 + 4 : 0;
      const room = Math.max(8, b.h - 2 * pad - headH - 4);
      return {
        headH,
        room,
        size: fitText(n().title, textW, room, 650, 64 / k),
      };
    };
    let badgeF = BADGE_PX / k;
    let r = solve(badgeF);
    if (badges && r.size * 0.5 > badgeF) {
      badgeF = r.size * 0.5;
      r = solve(badgeF);
    }
    const size = Math.max(r.size, Math.min(MIN_PX / k, r.room / 1.2));
    return {
      pad,
      badgeF,
      headH: r.headH,
      size,
      lines: Math.max(1, Math.floor(r.room / (size * 1.2))),
      badges,
    };
  });

  return (
    <Show when={props.box}>
      {(box) => (
        <div
          data-id={n().id}
          class={`node kind-${n().kind} status-${n().status} lod-${lod()}`}
          data-selected={s.selected() === n().id || undefined}
          data-dim={!props.lit || undefined}
          data-converge={props.paths > 1 || undefined}
          data-fresh={fresh() || undefined}
          data-busy={
            s.busy() === n().id ||
            s.busy() === `research:${n().id}` ||
            undefined
          }
          data-link-source={s.linkFrom() === n().id || undefined}
          data-key={n().weight === "key" || undefined}
          data-faint={isFaint(n()) || undefined}
          style={{
            left: `${box().x}px`,
            top: `${box().y}px`,
            width: `${box().w}px`,
            height: `${box().h}px`,
            padding: fit() ? `${fit()!.pad}px ${fit()!.pad + 2}px` : undefined,
          }}
          onPointerEnter={() => props.onHover(n().id)}
          onPointerLeave={() => props.onHover(null)}
        >
          <div
            class="node-head"
            style={
              fit()
                ? {
                    "font-size": `${fit()!.badgeF}px`,
                    height: `${fit()!.headH - 4}px`,
                    display: fit()!.badges ? undefined : "none",
                  }
                : undefined
            }
          >
            <span class="kind">{KIND_LABEL[n().kind]}</span>
            <Show when={props.next}>
              <span
                class="badge badge-next"
                title="An open task in Next steps moves this card forward"
              >
                next #{props.next}
              </span>
            </Show>
            <Show when={fresh()}>
              <span class="badge badge-new">new</span>
            </Show>
            <Show when={n().missed}>
              <span
                class="badge badge-missed"
                title="The agent thinks you may not have considered this"
              >
                new angle
              </span>
            </Show>
            <Show when={props.paths > 1}>
              <span
                class="badge badge-converge"
                title="Several paths arrive here"
              >
                {props.paths} paths meet
              </span>
            </Show>
            <Show when={n().research}>
              {(r) => (
                <span
                  class="badge badge-research"
                  data-done={r().status === "done" || undefined}
                  title={r().question}
                >
                  {RESEARCH_LABEL[r().status]}
                </span>
              )}
            </Show>
            <Show when={n().status === "chosen"}>
              <span class="badge badge-chosen">chosen</span>
            </Show>
            <Show when={n().feedback?.vote}>
              {(v) => (
                <span class={`badge badge-${v()}`}>{VOTE_LABEL[v()]}</span>
              )}
            </Show>
            <Show when={n().feedback?.comment.trim()}>
              <span class="badge badge-note">✎ note</span>
            </Show>
            <span
              class="by"
              title={n().by === "agent" ? "Added by the agent" : "Added by you"}
            >
              {n().by === "agent" ? "✦" : ""}
            </span>
          </div>
          <div
            class="title"
            style={
              fit()
                ? {
                    "font-size": `${fit()!.size}px`,
                    "line-height": `${fit()!.size * 1.2}px`,
                    "-webkit-line-clamp": String(fit()!.lines),
                  }
                : undefined
            }
          >
            {n().title}
          </div>
          <Show when={n().note}>
            <div class="note">{n().note}</div>
          </Show>
        </div>
      )}
    </Show>
  );
}
