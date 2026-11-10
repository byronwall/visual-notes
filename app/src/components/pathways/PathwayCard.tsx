import { Show } from "solid-js";
import type { MapNode } from "~/lib/pathways/frontier";
import type { CardFit } from "./card-fit";
import { isFaint } from "./layout";
import { usePathway } from "./pathway-state";

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

export function PathwayCard(props: {
  n: MapNode;
  box?: { x: number; y: number; w: number; h: number };
  lit: boolean;
  /** Zoom, in ~9% steps. */
  k: number;
  far: boolean;
  /** Title and badge sizes below full detail (see fitCards). */
  fit?: CardFit;
  next?: number;
  onHover: (id: string | null) => void;
}) {
  const s = usePathway();
  const n = () => props.n;
  // Level of detail by zoom. Below full detail the type label and note hide,
  // and the title grows to fill the card (see fitCards), in as many lines as
  // the card's fixed height allows. Positions never change with zoom.
  const lod = () => (props.far ? "far" : props.k >= 0.9 ? "full" : "mid");
  const fresh = () => s.freshNodes().has(n().id);
  const fit = () => (lod() === "full" ? undefined : props.fit);

  return (
    <Show when={props.box}>
      {(box) => (
        <div
          data-id={n().id}
          class={`node kind-${n().kind} status-${n().status} lod-${lod()}`}
          data-selected={String(!!(s.selected() === n().id))}
          data-dim={String(!props.lit)}
          data-fresh={String(!!fresh())}
          data-busy={
            s.busy() === n().id ||
            s.busy() === `research:${n().id}` ||
            s.busy() === `research-map:${n().id}` ||
            undefined
          }
          data-link-source={String(!!(s.linkFrom() === n().id))}
          data-key={String(!!(n().weight === "key"))}
          data-faint={String(isFaint(n()))}
          data-vote={n().feedback?.vote}
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
            <Show when={n().research}>
              {(r) => (
                <span
                  class="badge badge-research"
                  data-done={String(!!(r().status === "done"))}
                  title={r().question}
                >
                  {RESEARCH_LABEL[r().status]}
                </span>
              )}
            </Show>
            <Show when={n().fromResearch}>
              {(b) => (
                <span
                  class="badge badge-from-research"
                  title={`Built from research on: ${
                    s.record().graph.nodes.find((x) => x.id === b().nodeId)
                      ?.title ?? "a deleted card"
                  }`}
                >
                  from research
                </span>
              )}
            </Show>
            <Show when={n().status === "chosen"}>
              <span class="badge badge-chosen">chosen</span>
            </Show>
            <Show when={n().status === "done"}>
              <span class="badge badge-done">✓ done</span>
            </Show>
            <Show when={n().after}>
              {(a) => (
                <span
                  class="badge badge-after"
                  title={`Done before this:\n${a().join("\n")}`}
                >
                  ✓ {a()[0]}
                  {a().length > 1 ? ` +${a().length - 1}` : ""}
                </span>
              )}
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
