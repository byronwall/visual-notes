import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { inDegree, isFaint, layoutMap, lineage } from "./layout";
import { busy, fitTick, freshEdges, freshNodes, link, linkFrom, map, selected, setLinkFrom, setSelected } from "./state";
import type { PNode } from "./types";

const KIND_LABEL = { root: "Question", option: "Option", step: "Step", outcome: "Outcome" };
const VOTE_LABEL = { like: "♥ like", no: "✕ not for me", more: "↻ want better" };
const RESEARCH_LABEL = { suggested: "needs research", queued: "queued", running: "researching…", done: "researched" };

export function Graph() {
  let viewport!: HTMLDivElement;
  const [view, setView] = createSignal({ x: 0, y: 0, k: 1 });
  const [hover, setHover] = createSignal<string | null>(null);
  const [panning, setPanning] = createSignal(false);
  // Viewport size in 40px steps, so the packed layout does not redo on every pixel.
  const [size, setSize] = createSignal({ w: 1200, h: 800 });

  const layout = createMemo(() => {
    const m = map();
    return m ? layoutMap(m, size().w, size().h) : null;
  });
  const degree = createMemo(() => (map() ? inDegree(map()!) : new Map<string, number>()));
  const focus = createMemo(() => {
    const m = map();
    const id = (panning() ? null : hover()) ?? selected();
    return m && id ? lineage(m, id) : null;
  });

  const lit = (id: string) => {
    const f = focus();
    return !f || f.up.has(id) || f.down.has(id);
  };
  const edgeLit = (from: string, to: string) => {
    const f = focus();
    return !!f && ((f.up.has(from) && f.up.has(to)) || (f.down.has(from) && f.down.has(to)));
  };

  // A fit asked for before the viewport has a size waits for the resize observer.
  let fitPending = false;
  const fit = () => {
    const l = layout();
    const r = viewport?.getBoundingClientRect();
    if (!l || !r?.width || !r.height) return void (fitPending = true);
    fitPending = false;
    const k = Math.min(1.1, r.width / l.width, r.height / l.height);
    setView({ k, x: (r.width - l.width * k) / 2, y: (r.height - l.height * k) / 2 });
  };
  createEffect(on(fitTick, () => queueMicrotask(fit), { defer: true }));
  onMount(() => {
    const ro = new ResizeObserver(() => {
      const r = viewport.getBoundingClientRect();
      const w = Math.round(r.width / 40) * 40;
      const h = Math.round(r.height / 40) * 40;
      if (w && h && (w !== size().w || h !== size().h)) {
        setSize({ w, h });
        fitPending = true;
      }
      if (fitPending) fit();
    });
    ro.observe(viewport);
    onCleanup(() => ro.disconnect());
  });

  // Drag anywhere (cards included) to pan. A press that does not move is a
  // click: on a card it selects (or finishes a link), on the background it clears.
  let drag: { x: number; y: number; vx: number; vy: number; moved: boolean; node: string | null } | null = null;
  const onPointerDown = (e: PointerEvent) => {
    const el = e.target as HTMLElement;
    if (e.button !== 0 || el.closest(".view-tools")) return;
    e.preventDefault();
    const node = (el.closest(".node") as HTMLElement | null)?.dataset.id ?? null;
    drag = { x: e.clientX, y: e.clientY, vx: view().x, vy: view().y, moved: false, node };
    viewport.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    drag.moved = true;
    setPanning(true);
    setView((v) => ({ ...v, x: drag!.vx + dx, y: drag!.vy + dy }));
  };
  const onPointerUp = () => {
    if (drag && !drag.moved) {
      if (drag.node) clickNode(drag.node);
      else {
        setSelected(null);
        setLinkFrom(null);
      }
    }
    drag = null;
    setPanning(false);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const v = view();
    if (e.ctrlKey || e.metaKey) {
      const r = viewport.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const k = Math.min(2, Math.max(0.2, v.k * Math.exp(-e.deltaY * 0.01)));
      setView({ k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k });
    } else {
      setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
    }
  };

  const clickNode = (id: string) => {
    const from = linkFrom();
    if (from) {
      link(from, id);
      setLinkFrom(null);
    }
    setSelected(id);
  };

  return (
    <div
      ref={viewport}
      class="viewport"
      classList={{ linking: !!linkFrom(), panning: panning() }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <Show when={layout()}>
        {(l) => (
          <div
            class="canvas"
            style={{
              width: `${l().width}px`,
              height: `${l().height}px`,
              transform: `translate(${view().x}px, ${view().y}px) scale(${view().k})`,
            }}
          >
            <svg class="edges" width={l().width} height={l().height}>
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M1 1L7 4L1 7" class="arrow" />
                </marker>
                <marker id="arrow-lit" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M1 1L7 4L1 7" class="arrow lit" />
                </marker>
              </defs>
              <For each={map()!.edges}>
                {(e) => {
                  const d = () => l().paths.get(`${e.from}>${e.to}`);
                  const on = () => edgeLit(e.from, e.to);
                  const faint = () => map()!.nodes.some((n) => (n.id === e.from || n.id === e.to) && isFaint(n));
                  return (
                    <Show when={d()}>
                      <g classList={{ lit: on(), dim: !!focus() && !on(), fresh: freshEdges().has(`${e.from}>${e.to}`), faint: faint() }} class="edge">
                        <path d={d()} class="edge-halo" />
                        <path d={d()} class="edge-line" marker-end={on() ? "url(#arrow-lit)" : "url(#arrow)"} />
                      </g>
                    </Show>
                  );
                }}
              </For>
            </svg>
            <For each={map()!.nodes}>{(n) => <Card n={n} box={l().boxes.get(n.id)} paths={degree().get(n.id) ?? 0} lit={lit(n.id)} onHover={setHover} />}</For>
          </div>
        )}
      </Show>
      <div class="view-tools">
        <button onClick={fit} title="Fit the map to the window">
          Fit
        </button>
        <span class="hint">Drag to pan · ⌘/Ctrl + scroll to zoom</span>
      </div>
    </div>
  );
}

function Card(props: {
  n: PNode;
  box?: { x: number; y: number; w: number; h: number };
  paths: number;
  lit: boolean;
  onHover: (id: string | null) => void;
}) {
  const n = props.n;
  return (
    <Show when={props.box}>
      {(box) => (
        <div
          data-id={n.id}
          class={`node kind-${n.kind} status-${n.status}`}
          classList={{
            selected: selected() === n.id,
            dim: !props.lit,
            converge: props.paths > 1,
            fresh: freshNodes().has(n.id),
            busy: busy() === n.id || busy() === `research:${n.id}`,
            "link-source": linkFrom() === n.id,
            key: n.weight === "key",
            faint: isFaint(n),
          }}
          style={{ left: `${box().x}px`, top: `${box().y}px`, width: `${box().w}px`, height: `${box().h}px` }}
          onPointerEnter={() => props.onHover(n.id)}
          onPointerLeave={() => props.onHover(null)}
        >
          <div class="node-head">
            <span class="kind">{KIND_LABEL[n.kind]}</span>
            <Show when={freshNodes().has(n.id)}>
              <span class="badge new">new</span>
            </Show>
            <Show when={n.missed}>
              <span class="badge missed" title="The agent thinks you may not have considered this">
                new angle
              </span>
            </Show>
            <Show when={props.paths > 1}>
              <span class="badge converge" title="Several paths arrive here">
                {props.paths} paths meet
              </span>
            </Show>
            <Show when={n.research}>
              {(r) => (
                <span class={`badge research r-${r().status}`} title={r().question}>
                  {RESEARCH_LABEL[r().status]}
                </span>
              )}
            </Show>
            <Show when={n.status === "chosen"}>
              <span class="badge chosen">chosen</span>
            </Show>
            <Show when={n.feedback}>
              {(f) => (
                <span class={`badge vote vote-${f().vote}`} title={f().comment || undefined}>
                  {VOTE_LABEL[f().vote]}
                </span>
              )}
            </Show>
            <span class="by" title={n.by === "agent" ? "Added by the agent" : "Added by you"}>
              {n.by === "agent" ? "✦" : ""}
            </span>
          </div>
          <div class="title">{n.title}</div>
          <Show when={n.note}>
            <div class="note">{n.note}</div>
          </Show>
        </div>
      )}
    </Show>
  );
}
