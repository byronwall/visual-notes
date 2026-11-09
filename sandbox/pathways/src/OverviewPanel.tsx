import { createMemo, For, Index, Show } from "solid-js";
import { inDegree } from "./layout";
import { AutoText } from "./AutoText";
import { busy, map, runAgent, setSelected, updateContext } from "./state";
import type { PNode } from "./types";

/** Side panel when no node is selected: goals, feedback, and whole-map agent actions. */
export function OverviewPanel(props: { hint: string; setHint: (v: string) => void }) {
  const nodes = () => map()?.nodes ?? [];
  const ctx = () => map()?.context ?? { notes: "", qa: [] };
  const votes = createMemo(() => ({
    like: nodes().filter((n) => n.feedback?.vote === "like").length,
    no: nodes().filter((n) => n.feedback?.vote === "no").length,
    more: nodes().filter((n) => n.feedback?.vote === "more").length,
  }));
  const anyFeedback = () => votes().like + votes().no + votes().more > 0;
  const meets = createMemo(() => {
    const m = map();
    if (!m) return [];
    const deg = inDegree(m);
    return m.nodes.filter((n) => (deg.get(n.id) ?? 0) > 1).map((n) => ({ n, count: deg.get(n.id)! }));
  });
  const important = createMemo(() => nodes().filter((n) => n.weight === "key"));
  const research = createMemo(() => nodes().filter((n) => n.research && n.research.status !== "done"));
  const run = (a: "converge" | "options" | "questions" | "improve" | "regenerate") => runAgent(a, "root", props.hint);

  return (
    <>
      <div class="panel-section">
        <h3>Goals &amp; vibes</h3>
        <AutoText
          key={`${map()?.id}:notes`}
          minRows={3}
          maxHeight={360}
          placeholder="What matters to you here? What would a good month look like? What feels heavy?"
          value={ctx().notes}
          onSave={(v, k) => k === `${map()?.id}:notes` && updateContext((c) => (c.notes = v))}
        />
        <Index each={ctx().qa}>
          {(qa, i) => (
            <div class="qa" classList={{ open: !qa().a.trim() }}>
              <div class="qa-q">
                <span>{qa().q}</span>
                <button class="x" title="Remove this question" onClick={() => updateContext((c) => c.qa.splice(i, 1))}>
                  ×
                </button>
              </div>
              <AutoText
                key={`${map()?.id}:qa:${qa().q}`}
                maxHeight={240}
                placeholder="Your answer"
                value={qa().a}
                onSave={(v, k) =>
                  updateContext((c) => {
                    const hit = c.qa.find((x) => `${map()?.id}:qa:${x.q}` === k);
                    if (hit) hit.a = v;
                  })
                }
              />
            </div>
          )}
        </Index>
        <div class="agent-buttons">
          <button disabled={!!busy()} onClick={() => run("questions")}>
            {busy() === "map" ? "Thinking…" : ctx().qa.length ? "Ask me more" : "Ask me about my goals"}
          </button>
        </div>
        <p class="help">Every agent action reads these answers.</p>
      </div>

      <div class="panel-section">
        <h3>Your feedback</h3>
        <p class="help">
          <Show when={anyFeedback()} fallback="Select a node and react: 1 like · 2 not for me · 3 want better · 4 important · 5 noise.">
            {votes().like} liked · {votes().no} not for me · {votes().more} want better
          </Show>
        </p>
        <AutoText
          value={props.hint}
          placeholder={`Steer it (optional). ⌘↵ runs ${anyFeedback() ? "Improve from feedback" : "What am I missing?"}`}
          delay={0}
          onSave={props.setHint}
          onSubmit={(v) => {
            props.setHint(v);
            queueMicrotask(() => run(anyFeedback() ? "improve" : "options"));
          }}
        />
        <div class="agent-buttons">
          <button class="primary" disabled={!!busy() || !anyFeedback()} onClick={() => run("improve")}>
            Improve from feedback
          </button>
          <button disabled={!!busy()} onClick={() => run("regenerate")} title="Builds a new version as a separate map; this one stays">
            Fresh map from feedback
          </button>
        </div>
        <div class="agent-buttons">
          <button disabled={!!busy()} onClick={() => run("converge")}>
            Where do paths meet?
          </button>
          <button disabled={!!busy()} onClick={() => run("options")}>
            What am I missing?
          </button>
        </div>
      </div>

      <NodeLinks title="Important" nodes={important()} />
      <div class="panel-section">
        <h3>Where paths meet</h3>
        <Show when={meets().length} fallback={<p class="help">No shared nodes yet.</p>}>
          <ul class="edge-list">
            <For each={meets()}>
              {(x) => (
                <li>
                  <button class="link" onClick={() => setSelected(x.n.id)}>
                    {x.n.title}
                  </button>
                  <span class="count">{x.count} paths</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>
      <NodeLinks title="Needs research" nodes={research()} />
    </>
  );
}

function NodeLinks(props: { title: string; nodes: PNode[] }) {
  return (
    <Show when={props.nodes.length}>
      <div class="panel-section">
        <h3>{props.title}</h3>
        <ul class="edge-list">
          <For each={props.nodes}>
            {(n) => (
              <li>
                <button class="link" onClick={() => setSelected(n.id)}>
                  {n.title}
                </button>
              </li>
            )}
          </For>
        </ul>
      </div>
    </Show>
  );
}
