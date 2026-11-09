import { createMemo, createSignal, For, Show } from "solid-js";
import { inDegree } from "./layout";
import {
  addChild,
  busy,
  linkFrom,
  map,
  removeNode,
  runAgent,
  selected,
  setLinkFrom,
  setSelected,
  unlink,
  updateNode,
} from "./state";
import type { Kind, Status } from "./types";

const KINDS: Kind[] = ["option", "step", "outcome"];
const STATUSES: Status[] = ["open", "chosen", "dropped"];

export function Panel() {
  const [hint, setHint] = createSignal("");
  const node = createMemo(() => map()?.nodes.find((n) => n.id === selected()) ?? null);
  const title = (id: string) => map()?.nodes.find((n) => n.id === id)?.title ?? id;
  const parents = createMemo(() => map()?.edges.filter((e) => e.to === selected()) ?? []);
  const children = createMemo(() => map()?.edges.filter((e) => e.from === selected()) ?? []);

  return (
    <aside class="panel">
      <Show when={node()} fallback={<Overview hint={hint()} setHint={setHint} />}>
        {(n) => (
          <>
            <div class="panel-section">
              <div class="panel-row">
                <Show
                  when={n().kind !== "root"}
                  fallback={<span class="kind-pill kind-root">Question</span>}
                >
                  <select
                    value={n().kind}
                    onChange={(e) => updateNode(n().id, { kind: e.currentTarget.value as Kind })}
                  >
                    <For each={KINDS}>{(k) => <option value={k}>{k}</option>}</For>
                  </select>
                </Show>
                <div class="seg">
                  <For each={STATUSES}>
                    {(s) => (
                      <button
                        classList={{ on: n().status === s }}
                        onClick={() => updateNode(n().id, { status: s })}
                      >
                        {s}
                      </button>
                    )}
                  </For>
                </div>
              </div>
              <textarea
                class="title-input"
                rows={2}
                value={n().title}
                onChange={(e) => updateNode(n().id, { title: e.currentTarget.value })}
              />
              <textarea
                class="note-input"
                rows={2}
                placeholder="Why, cost, tradeoff…"
                value={n().note}
                onChange={(e) => updateNode(n().id, { note: e.currentTarget.value })}
              />
            </div>

            <div class="panel-section">
              <h3>Ask the agent</h3>
              <input
                class="hint-input"
                placeholder="Steer it (optional): “I have 2 weeks”, “cheap only”…"
                value={hint()}
                onInput={(e) => setHint(e.currentTarget.value)}
              />
              <div class="agent-buttons">
                <button
                  class="primary"
                  disabled={!!busy()}
                  onClick={() => runAgent("options", n().id, hint())}
                  title="Add options you have not listed, including ones you may not have considered"
                >
                  {busy() === n().id ? "Thinking…" : "What are my options?"}
                </button>
                <button
                  disabled={!!busy() || n().kind === "root"}
                  onClick={() => runAgent("forward", n().id, hint())}
                  title="Add the next 1–3 steps that likely follow, reusing existing nodes where paths meet"
                >
                  Play it forward
                </button>
              </div>
            </div>

            <div class="panel-section">
              <h3>Edit by hand</h3>
              <div class="agent-buttons">
                <button onClick={() => addChild(n().id, "option")}>+ Option</button>
                <button onClick={() => addChild(n().id, "step")}>+ Step</button>
                <button onClick={() => addChild(n().id, "outcome")}>+ Outcome</button>
                <button
                  classList={{ on: linkFrom() === n().id }}
                  onClick={() => setLinkFrom(linkFrom() ? null : n().id)}
                  title="Then click the node this one leads to"
                >
                  {linkFrom() === n().id ? "Click a target…" : "Leads to…"}
                </button>
                <Show when={n().id !== "root"}>
                  <button class="danger" onClick={() => removeNode(n().id)}>
                    Delete
                  </button>
                </Show>
              </div>
            </div>

            <Show when={parents().length + children().length > 0}>
              <div class="panel-section">
                <Show when={parents().length}>
                  <h3>Comes from</h3>
                  <EdgeList ids={parents().map((e) => e.from)} title={title} onRemove={(id) => unlink(id, n().id)} />
                </Show>
                <Show when={children().length}>
                  <h3>Leads to</h3>
                  <EdgeList ids={children().map((e) => e.to)} title={title} onRemove={(id) => unlink(n().id, id)} />
                </Show>
              </div>
            </Show>
          </>
        )}
      </Show>
    </aside>
  );
}

function EdgeList(props: { ids: string[]; title: (id: string) => string; onRemove: (id: string) => void }) {
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

function Overview(props: { hint: string; setHint: (v: string) => void }) {
  const meets = createMemo(() => {
    const m = map();
    if (!m) return [];
    const deg = inDegree(m);
    return m.nodes.filter((n) => (deg.get(n.id) ?? 0) > 1).map((n) => ({ n, count: deg.get(n.id)! }));
  });
  const missed = createMemo(() => map()?.nodes.filter((n) => n.missed && n.status !== "dropped") ?? []);

  return (
    <>
      <div class="panel-section">
        <h3>Whole map</h3>
        <input
          class="hint-input"
          placeholder="Steer it (optional)"
          value={props.hint}
          onInput={(e) => props.setHint(e.currentTarget.value)}
        />
        <div class="agent-buttons">
          <button class="primary" disabled={!!busy()} onClick={() => runAgent("converge", "root", props.hint)}>
            {busy() === "map" ? "Thinking…" : "Where do paths meet?"}
          </button>
          <button disabled={!!busy()} onClick={() => runAgent("options", "root", props.hint)}>
            {busy() === "root" ? "Thinking…" : "What am I missing?"}
          </button>
        </div>
        <p class="help">
          Click a node to ask for options or play it forward. Hover a node to trace every path through it.
        </p>
      </div>

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

      <Show when={missed().length}>
        <div class="panel-section">
          <h3>New angles</h3>
          <ul class="edge-list">
            <For each={missed()}>
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
    </>
  );
}
