import { createMemo, createSignal, For, Show } from "solid-js";
import { AutoText } from "./AutoText";
import {
  addChild,
  busy,
  linkFrom,
  map,
  removeNode,
  runAgent,
  titleFocus,
  runResearch,
  setLinkFrom,
  setResearch,
  setSelected,
  unlink,
  updateNode,
} from "./state";
import type { Feedback, Kind, PNode, Status } from "./types";

const KINDS: Kind[] = ["option", "step", "outcome"];
const STATUSES: Status[] = ["open", "chosen", "dropped"];
export const VOTES: { vote: Feedback["vote"]; label: string; key: string }[] = [
  { vote: "like", label: "Like", key: "1" },
  { vote: "no", label: "Not for me", key: "2" },
  { vote: "more", label: "Want better", key: "3" },
];
export const WEIGHTS: { weight: PNode["weight"]; label: string; key: string }[] = [
  { weight: "key", label: "Important", key: "4" },
  { weight: undefined, label: "Normal", key: "" },
  { weight: "noise", label: "Noise", key: "5" },
];

export const setVote = (n: PNode, vote: Feedback["vote"]) =>
  updateNode(n.id, { feedback: n.feedback?.vote === vote ? undefined : { vote, comment: n.feedback?.comment ?? "" } });
export const setWeight = (n: PNode, weight: PNode["weight"]) =>
  updateNode(n.id, { weight: n.weight === weight ? undefined : weight });

export function NodePanel(props: { n: PNode; hint: string; setHint: (v: string) => void }) {
  const n = () => props.n;
  const title = (id: string) => map()?.nodes.find((x) => x.id === id)?.title ?? id;
  const parents = createMemo(() => map()?.edges.filter((e) => e.to === n().id).map((e) => e.from) ?? []);
  const children = createMemo(() => map()?.edges.filter((e) => e.from === n().id).map((e) => e.to) ?? []);
  // Clicking a reaction puts the cursor in its "why" box. Keys 1–3 do not, so they stay fast.
  const [commentFocus, setCommentFocus] = createSignal(0);
  const steer = (action: "options" | "forward") => runAgent(action, n().id, props.hint);
  // Saves go to the node the text was typed for, found by the field key "<id>:<field>".
  const nodeOf = (key?: string) => map()?.nodes.find((x) => x.id === key?.split(":")[0]);

  return (
    <>
      <div class="panel-section">
        <div class="panel-row">
          <Show when={n().kind !== "root"} fallback={<span class="kind-pill">Question</span>}>
            <select value={n().kind} onChange={(e) => updateNode(n().id, { kind: e.currentTarget.value as Kind })}>
              <For each={KINDS}>{(k) => <option value={k}>{k}</option>}</For>
            </select>
            <div class="seg">
              <For each={STATUSES}>
                {(s) => (
                  <button classList={{ on: n().status === s }} onClick={() => updateNode(n().id, { status: s })}>
                    {s}
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
        <AutoText
          class="title-input"
          key={`${n().id}:title`}
          singleLine
          value={n().title}
          focusTick={titleFocus()}
          placeholder="Title"
          onSave={(v, k) => v.trim() && nodeOf(k) && updateNode(nodeOf(k)!.id, { title: v.trim() })}
        />
        <AutoText
          class="note-input"
          key={`${n().id}:note`}
          minRows={2}
          value={n().note}
          placeholder="Why, cost, tradeoff…"
          onSave={(v, k) => nodeOf(k) && updateNode(nodeOf(k)!.id, { note: v })}
        />
      </div>

      <Show when={n().kind !== "root"}>
        <div class="panel-section">
          <h3>Your take</h3>
          <div class="seg wide">
            <For each={VOTES}>
              {(v) => (
                <button classList={{ on: n().feedback?.vote === v.vote, [`vote-${v.vote}`]: true }} onClick={() => {
                    setVote(n(), v.vote);
                    if (n().feedback?.vote !== v.vote) setCommentFocus((t) => t + 1);
                  }}
                  title={`Key ${v.key}`}
                >
                  {v.label}
                </button>
              )}
            </For>
          </div>
          <Show when={n().feedback}>
            <AutoText
              key={`${n().id}:comment`}
              value={n().feedback!.comment}
              focusTick={commentFocus()}
              placeholder="Why? The agent reads this."
              onSave={(v, k) => {
                const t = nodeOf(k);
                if (t?.feedback) updateNode(t.id, { feedback: { ...t.feedback, comment: v } });
              }}
            />
          </Show>
          <div class="seg wide">
            <For each={WEIGHTS}>
              {(w) => (
                <button classList={{ on: n().weight === w.weight }} onClick={() => updateNode(n().id, { weight: w.weight })} title={w.key ? `Key ${w.key}` : ""}>
                  {w.label}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      <div class="panel-section">
        <h3>Ask the agent</h3>
        <AutoText
          value={props.hint}
          placeholder="Steer it (optional): “I have 2 weeks”, “cheap only”… ⌘↵ asks for options"
          delay={0}
          onSave={props.setHint}
          onSubmit={(v) => {
            props.setHint(v);
            queueMicrotask(() => steer("options"));
          }}
        />
        <div class="agent-buttons">
          <button class="primary" disabled={!!busy()} onClick={() => steer("options")}>
            {busy() === n().id ? "Thinking…" : "What are my options?"}
          </button>
          <button disabled={!!busy() || n().kind === "root"} onClick={() => steer("forward")}>
            Play it forward
          </button>
        </div>
      </div>

      <ResearchSection n={n()} />

      <div class="panel-section">
        <h3>Edit by hand</h3>
        <div class="agent-buttons">
          <button onClick={() => addChild(n().id, "option")}>+ Option</button>
          <button onClick={() => addChild(n().id, "step")}>+ Step</button>
          <button onClick={() => addChild(n().id, "outcome")}>+ Outcome</button>
          <button classList={{ on: linkFrom() === n().id }} onClick={() => setLinkFrom(linkFrom() ? null : n().id)}>
            {linkFrom() === n().id ? "Click a target…" : "Leads to…"}
          </button>
          <Show when={n().id !== "root"}>
            <button class="danger" onClick={() => removeNode(n().id)}>
              Delete
            </button>
          </Show>
        </div>
        <Show when={parents().length}>
          <h3>Comes from</h3>
          <EdgeList ids={parents()} title={title} onRemove={(id) => unlink(id, n().id)} />
        </Show>
        <Show when={children().length}>
          <h3>Leads to</h3>
          <EdgeList ids={children()} title={title} onRemove={(id) => unlink(n().id, id)} />
        </Show>
      </div>
    </>
  );
}

function ResearchSection(props: { n: PNode }) {
  const r = () => props.n.research;
  const id = () => props.n.id;
  return (
    <div class="panel-section">
      <h3>Research</h3>
      <Show
        when={r()}
        fallback={
          <button onClick={() => setResearch(id(), { question: `What do I need to know to act on: ${props.n.title}?`, status: "suggested" })}>
            Needs research…
          </button>
        }
      >
        <AutoText
          key={`${id()}:research`}
          value={r()!.question}
          placeholder="What do you need to find out?"
          onSave={(v, k) => {
            const t = map()?.nodes.find((x) => `${x.id}:research` === k);
            if (t?.research && v.trim()) setResearch(t.id, { ...t.research, question: v.trim() });
          }}
          onSubmit={() => queueMicrotask(() => runResearch(id()))}
        />
        <div class="agent-buttons">
          <button class="primary" disabled={!!busy()} onClick={() => runResearch(id())} title="OpenAI web search, about 20–60 seconds">
            {busy() === `research:${id()}` ? "Searching the web…" : r()!.status === "done" ? "Research again" : "Research now"}
          </button>
          <button
            classList={{ on: r()!.status === "queued" }}
            onClick={() => setResearch(id(), { ...r()!, status: r()!.status === "queued" ? "suggested" : "queued" })}
            title="Leave it for an outside agent: GET /api/research lists the queue"
          >
            {r()!.status === "queued" ? "Queued for an agent" : "Queue for an agent"}
          </button>
          <button class="x" title="Remove the research question" onClick={() => setResearch(id(), undefined)}>
            ×
          </button>
        </div>
        <Show when={r()!.findings}>
          <div class="findings">{r()!.findings}</div>
          <Show when={r()!.sources?.length}>
            <ul class="sources">
              <For each={r()!.sources}>
                {(s) => (
                  <li>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title || s.url}
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <p class="help">From {r()!.by ?? "research"}. The agent reads these findings.</p>
        </Show>
      </Show>
    </div>
  );
}

export function EdgeList(props: { ids: string[]; title: (id: string) => string; onRemove: (id: string) => void }) {
  return (
    <ul class="edge-list">
      <For each={props.ids}>
        {(id) => (
          <li>
            <button class="link" onClick={() => setSelected(id)}>
              {props.title(id)}
            </button>
            <button class="x" title="Remove this connection" onClick={() => props.onRemove(id)}>
              ×
            </button>
          </li>
        )}
      </For>
    </ul>
  );
}
