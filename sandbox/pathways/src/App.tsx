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
  setTitleFocus,
  setView,
  undo,
  view,
} from "./state";
import { NextSteps } from "./NextSteps";
import { AutoText } from "./AutoText";
import { setVote, setWeight, VOTES, WEIGHTS } from "./NodePanel";

export function App() {
  const openTasks = () => map()?.plan?.tasks.filter((t) => t.status === "todo").length ?? 0;
  // New-map popover: the question plus optional context that seeds Goals & vibes.
  const [draft, setDraft] = createSignal<{ q: string; notes: string } | null>(null);

  onMount(async () => {
    await refreshList();
    const last = localStorage.getItem("pathways:last");
    const id = maps().find((m) => m.id === last)?.id ?? maps()[0]?.id;
    if (id) await openMap(id);
  });

  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea, select")) return;
    if (e.key === "Escape" && draft()) return void setDraft(null);
    if (e.key === "Enter" && selected() && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      setTitleFocus((t) => t + 1);
      return;
    }
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
    const d = draft();
    if (!d?.q.trim()) return;
    setDraft(null);
    await createMap(d.q.trim(), d.notes);
  };

  return (
    <div class="app">
      <header class="bar">
        <strong class="brand">Pathways</strong>
        <select value={map()?.id ?? ""} onChange={(e) => openMap(e.currentTarget.value)}>
          <For each={maps()}>{(m) => <option value={m.id}>{m.title}</option>}</For>
        </select>
        <div class="new-map-anchor">
          <button classList={{ on: !!draft() }} onClick={() => setDraft(draft() ? null : { q: "", notes: "" })}>
            New map
          </button>
          <Show when={draft()}>
            {(d) => (
              <div class="new-map-pop">
                <label>What are you deciding?</label>
                <AutoText
                  class="title-input"
                  singleLine
                  autofocus
                  delay={0}
                  value={d().q}
                  placeholder="Where should I spend my next two weekends?"
                  onSave={(v) => setDraft((x) => x && { ...x, q: v })}
                  onSubmit={(v) => {
                    setDraft((x) => x && { ...x, q: v });
                    void submitDraft();
                  }}
                />
                <label>Context (optional)</label>
                <AutoText
                  minRows={3}
                  maxHeight={320}
                  delay={0}
                  value={d().notes}
                  placeholder="What matters to you, what you have tried, what feels stuck. Goes into Goals & vibes."
                  onSave={(v) => setDraft((x) => x && { ...x, notes: v })}
                  onSubmit={(v) => {
                    setDraft((x) => x && { ...x, notes: v });
                    void submitDraft();
                  }}
                />
                <div class="panel-row">
                  <span class="muted">⌘↵ to create · Esc twice to cancel</span>
                  <span class="spacer" />
                  <button onClick={() => setDraft(null)}>Cancel</button>
                  <button class="primary" disabled={!d().q.trim()} onClick={submitDraft}>
                    Create
                  </button>
                </div>
              </div>
            )}
          </Show>
        </div>
        <div class="seg view-switch">
          <button classList={{ on: view() === "map" }} onClick={() => setView("map")}>
            Map
          </button>
          <button classList={{ on: view() === "next" }} onClick={() => setView("next")}>
            Next steps
            <Show when={openTasks()}>
              <span class="count-pill">{openTasks()}</span>
            </Show>
          </button>
        </div>
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
      {/* Both views stay mounted, so the map keeps its zoom and routes across switches. */}
      <main class="body" classList={{ hidden: view() !== "map" }}>
        <Graph />
        <Panel />
      </main>
      <main class="body" classList={{ hidden: view() !== "next" }}>
        <NextSteps />
      </main>
    </div>
  );
}
