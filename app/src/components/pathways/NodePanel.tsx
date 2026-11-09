import { createMemo, createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import type {
  Feedback,
  NodeKind,
  NodeStatus,
  PathwayNode,
} from "~/lib/pathways/types";
import { ActionButton } from "./ActionButton";
import { AutoText } from "./AutoText";
import { usePathway, type PathwayState } from "./pathway-state";
import {
  cardLink,
  help,
  iconX,
  label,
  linkList,
  row,
  section,
  seg,
  smallButton,
} from "./styles";

const KINDS: Exclude<NodeKind, "root">[] = ["option", "step", "outcome"];
const STATUSES: NodeStatus[] = ["open", "chosen", "dropped"];
export const VOTES: {
  vote: NonNullable<Feedback["vote"]>;
  label: string;
  key: string;
}[] = [
  { vote: "like", label: "Like", key: "1" },
  { vote: "no", label: "Not for me", key: "2" },
  { vote: "more", label: "Want better", key: "3" },
];
export const WEIGHTS: {
  weight: PathwayNode["weight"];
  label: string;
  key: string;
}[] = [
  { weight: "key", label: "Important", key: "4" },
  { weight: undefined, label: "Normal", key: "" },
  { weight: "noise", label: "Noise", key: "5" },
];

/** A take with no reaction and no text is no take at all. */
const take = (vote: Feedback["vote"], comment: string): Feedback | null =>
  vote || comment.trim() ? { ...(vote ? { vote } : {}), comment } : null;

export const setVote = (
  s: PathwayState,
  n: PathwayNode,
  vote: Feedback["vote"],
) =>
  s.updateNode(n.id, {
    feedback: take(
      n.feedback?.vote === vote ? undefined : vote,
      n.feedback?.comment ?? "",
    ),
  });
export const setWeight = (
  s: PathwayState,
  n: PathwayNode,
  weight: PathwayNode["weight"],
) =>
  s.updateNode(n.id, { weight: n.weight === weight ? null : weight ?? null });

const titleField = css({
  fontSize: "md",
  fontWeight: "semibold",
  lineHeight: "1.35",
});
const select = css({
  h: "7",
  px: "2",
  fontSize: "xs",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "md",
  bg: "bg.default",
  color: "fg.default",
});
const wrap = css({ display: "flex", flexWrap: "wrap", gap: "1.5" });
const findings = css({
  whiteSpace: "pre-wrap",
  fontSize: "xs",
  lineHeight: "1.5",
  p: "2",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "md",
  bg: "bg.subtle",
});

export function NodePanel(props: { n: PathwayNode }) {
  const s = usePathway();
  const n = () => props.n;
  const graph = () => s.record().graph;
  const title = (id: string) =>
    graph().nodes.find((x) => x.id === id)?.title ?? id;
  const parents = createMemo(() =>
    graph()
      .edges.filter((e) => e.to === n().id)
      .map((e) => e.from),
  );
  const children = createMemo(() =>
    graph()
      .edges.filter((e) => e.from === n().id)
      .map((e) => e.to),
  );
  // Clicking a reaction puts the cursor in its "why" box. Keys 1–3 do not, so they stay fast.
  const [commentFocus, setCommentFocus] = createSignal(0);
  const steer = (action: "options" | "forward") => s.runAgent(action, n().id);
  // Saves go to the card the text was typed for, found by the field key "<id>:<field>".
  const nodeOf = (key?: string) =>
    graph().nodes.find((x) => x.id === key?.split(":")[0]);

  return (
    <>
      <div class={section}>
        <Show
          when={n().kind !== "root"}
          fallback={<span class={label}>Question</span>}
        >
          <div class={row}>
            <select
              class={select}
              value={n().kind}
              onChange={(e) =>
                s.updateNode(n().id, {
                  kind: e.currentTarget.value as Exclude<NodeKind, "root">,
                })
              }
            >
              <For each={KINDS}>{(k) => <option value={k}>{k}</option>}</For>
            </select>
            <div class={seg} style={{ "margin-left": "auto" }}>
              <For each={STATUSES}>
                {(st) => (
                  <button
                    data-on={String(!!(n().status === st))}
                    onClick={() => s.updateNode(n().id, { status: st })}
                  >
                    {st}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>
        <AutoText
          class={titleField}
          key={`${n().id}:title`}
          singleLine
          value={n().title}
          focusTick={s.titleFocus()}
          placeholder="Title"
          onSave={(v, k) =>
            v.trim() &&
            nodeOf(k) &&
            s.updateNode(nodeOf(k)!.id, { title: v.trim() }, k)
          }
        />
        <AutoText
          key={`${n().id}:note`}
          minRows={2}
          value={n().note}
          placeholder="Why, cost, tradeoff…"
          onSave={(v, k) =>
            nodeOf(k) && s.updateNode(nodeOf(k)!.id, { note: v }, k)
          }
        />
      </div>

      <Show when={n().kind !== "root"}>
        <div class={section}>
          <span class={label}>Your take</span>
          <div class={seg}>
            <For each={VOTES}>
              {(v) => (
                <button
                  data-on={String(!!(n().feedback?.vote === v.vote))}
                  data-tone={v.vote}
                  title={`Key ${v.key}`}
                  onClick={() => {
                    const turningOn = n().feedback?.vote !== v.vote;
                    setVote(s, n(), v.vote);
                    if (turningOn) setCommentFocus((t) => t + 1);
                  }}
                >
                  {v.label}
                </button>
              )}
            </For>
          </div>
          <AutoText
            key={`${n().id}:comment`}
            minRows={2}
            value={n().feedback?.comment ?? ""}
            focusTick={commentFocus()}
            placeholder="Your thoughts on this, in your own words. The agent reads them."
            onSave={(v, k) => {
              const t = nodeOf(k);
              if (t)
                s.updateNode(t.id, { feedback: take(t.feedback?.vote, v) }, k);
            }}
          />
          <div class={seg}>
            <For each={WEIGHTS}>
              {(w) => (
                <button
                  data-on={String(!!(n().weight === w.weight))}
                  title={w.key ? `Key ${w.key}` : ""}
                  onClick={() =>
                    s.updateNode(n().id, { weight: w.weight ?? null })
                  }
                >
                  {w.label}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      <div class={section}>
        <span class={label}>Ask the agent</span>
        <AutoText
          key={`${n().id}:steer`}
          value={s.steer()}
          delay={0}
          placeholder="Steer it (optional): “I have 2 weeks”, “cheap only”…"
          onSave={(v) => s.setSteer(v)}
          onSubmit={(v) => {
            s.setSteer(v);
            queueMicrotask(() => steer("options"));
          }}
        />
        <ActionButton
          primary
          label="More choices from here"
          shortcut="⌘↵"
          what={
            n().kind === "root"
              ? "Adds 2–5 answers to the question that are not on the map yet, including ones you may not have thought of."
              : "Adds 2–5 different choices that could follow from this card, including ones you may not have thought of."
          }
          busy={s.busy() === n().id}
          disabled={!!s.busy()}
          onClick={() => steer("options")}
        />
        <Show when={n().kind !== "root"}>
          <ActionButton
            label="What happens next"
            what="Adds the likely next 1–3 steps if you go this way, and links to cards already on the map where paths meet."
            disabled={!!s.busy()}
            onClick={() => steer("forward")}
          />
        </Show>
      </div>

      <ResearchSection n={n()} />

      <div class={section}>
        <span class={label}>Edit by hand</span>
        <div class={wrap}>
          <button
            class={smallButton}
            onClick={() => s.addChild(n().id, "option")}
          >
            + Option
          </button>
          <button
            class={smallButton}
            onClick={() => s.addChild(n().id, "step")}
          >
            + Step
          </button>
          <button
            class={smallButton}
            onClick={() => s.addChild(n().id, "outcome")}
          >
            + Outcome
          </button>
          <button
            class={smallButton}
            data-on={String(!!(s.linkFrom() === n().id))}
            onClick={() => s.setLinkFrom(s.linkFrom() ? null : n().id)}
          >
            {s.linkFrom() === n().id ? "Click a target…" : "Leads to…"}
          </button>
          <Show when={n().id !== "root"}>
            <button
              class={smallButton}
              data-danger="true"
              onClick={() => s.removeNode(n().id)}
            >
              Delete
            </button>
          </Show>
        </div>
        <Show when={parents().length}>
          <span class={label}>Comes from</span>
          <EdgeList
            ids={parents()}
            title={title}
            onRemove={(id) => s.unlink(id, n().id)}
          />
        </Show>
        <Show when={children().length}>
          <span class={label}>Leads to</span>
          <EdgeList
            ids={children()}
            title={title}
            onRemove={(id) => s.unlink(n().id, id)}
          />
        </Show>
      </div>
    </>
  );
}

function ResearchSection(props: { n: PathwayNode }) {
  const s = usePathway();
  const r = () => props.n.research;
  const id = () => props.n.id;
  return (
    <div class={section}>
      <span class={label}>Research</span>
      <Show
        when={r()}
        fallback={
          <button
            class={smallButton}
            onClick={() =>
              s.setResearch(id(), {
                question: `What do I need to know to act on: ${props.n.title}?`,
                status: "suggested",
              })
            }
          >
            Needs research…
          </button>
        }
      >
        <AutoText
          key={`${id()}:research`}
          value={r()!.question}
          placeholder="What do you need to find out?"
          onSave={(v, k) => {
            const t = s
              .record()
              .graph.nodes.find((x) => `${x.id}:research` === k);
            if (t?.research && v.trim())
              s.setResearch(t.id, { ...t.research, question: v.trim() });
          }}
          onSubmit={() => queueMicrotask(() => s.runResearch(id()))}
        />
        <div class={wrap}>
          <button
            class={smallButton}
            disabled={!!s.busy()}
            onClick={() => s.runResearch(id())}
            title="OpenAI web search, about 30–60 seconds"
          >
            {s.busy() === `research:${id()}`
              ? "Searching the web…"
              : r()!.status === "done"
                ? "Research again"
                : "Research now"}
          </button>
          <button
            class={smallButton}
            data-on={String(!!(r()!.status === "queued"))}
            title="Leave it for Claude or ChatGPT: pathways_get lists the research queue"
            onClick={() =>
              s.setResearch(id(), {
                ...r()!,
                status: r()!.status === "queued" ? "suggested" : "queued",
              })
            }
          >
            {r()!.status === "queued"
              ? "Queued for an agent"
              : "Queue for an agent"}
          </button>
          <button
            class={iconX}
            title="Remove the research question"
            onClick={() => s.setResearch(id(), undefined)}
          >
            ×
          </button>
        </div>
        <Show when={r()!.findings}>
          <div class={findings}>{r()!.findings}</div>
          <Show when={r()!.sources?.length}>
            <ul class={linkList}>
              <For each={r()!.sources}>
                {(src) => (
                  <li>
                    <a
                      class={cardLink}
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {src.title || src.url}
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <p class={help}>
            From {r()!.by ?? "research"}. The agent reads these findings.
          </p>
        </Show>
      </Show>
    </div>
  );
}

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
