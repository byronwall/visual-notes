import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Graph } from "./Graph";
import { Panel } from "./Panel";
import {
  createMap,
  error,
  linkFrom,
  map,
  maps,
  openMap,
  refreshList,
  removeNode,
  selected,
  setError,
  setLinkFrom,
  setSelected,
  undo,
} from "./state";
import { setVote, setWeight, VOTES, WEIGHTS } from "./NodePanel";

export function App() {
  const [draft, setDraft] = createSignal<string | null>(null);

  onMount(async () => {
    await refreshList();
    const last = localStorage.getItem("pathways:last");
    const id = maps().find((m) => m.id === last)?.id ?? maps()[0]?.id;
    if (id) await openMap(id);
  });

  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea, select")) return;
    if (e.key === "Escape") {
      if (linkFrom()) setLinkFrom(null);
      else setSelected(null);
    }
    const node = map()?.nodes.find((n) => n.id === selected());
    if (node && node.kind !== "root" && !e.metaKey && !e.ctrlKey) {
      const vote = VOTES.find((v) => v.key === e.key);
      const weight = WEIGHTS.find((w) => w.key && w.key === e.key);
      if (vote) setVote(node, vote.vote);
      if (weight) setWeight(node, weight.weight);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "z") {
      e.preventDefault();
      void undo();
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selected()) removeNode(selected()!);
  };
  window.addEventListener("keydown", onKey);
  onCleanup(() => window.removeEventListener("keydown", onKey));

  const submitDraft = async () => {
    const t = draft()?.trim();
    setDraft(null);
    if (t) await createMap(t);
  };

  return (
    <div class="app">
      <header class="bar">
        <strong class="brand">Pathways</strong>
        <select value={map()?.id ?? ""} onChange={(e) => openMap(e.currentTarget.value)}>
          <For each={maps()}>{(m) => <option value={m.id}>{m.title}</option>}</For>
        </select>
        <Show
          when={draft() !== null}
          fallback={<button onClick={() => setDraft("")}>New map</button>}
        >
          <input
            class="new-map"
            autofocus
            placeholder="What are you deciding?"
            value={draft()!}
            onInput={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitDraft();
              if (e.key === "Escape") setDraft(null);
            }}
          />
          <button class="primary" onClick={submitDraft}>
            Create
          </button>
        </Show>
        <button onClick={undo} title="Undo the last change (⌘Z), including agent changes">
          Undo
        </button>
        <span class="spacer" />
        <Show when={linkFrom()}>
          <span class="status">Click the node this leads to · Esc to cancel</span>
        </Show>
        <span class="legend">
          <i class="sw kind-option" /> option <i class="sw kind-step" /> step <i class="sw kind-outcome" /> outcome
          <i class="sw converge" /> paths meet
        </span>
      </header>
      <Show when={error()}>
        <div class="message error">
          <span>{error()}</span>
          <button class="x" onClick={() => setError("")}>
            ×
          </button>
        </div>
      </Show>
      <main class="body">
        <Graph />
        <Panel />
      </main>
    </div>
  );
}
