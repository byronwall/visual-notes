import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { edgePath, inDegree, layoutMap, lineage } from "./layout";
import { busy, fitTick, fresh, link, linkFrom, map, selected, setLinkFrom, setSelected } from "./state";
import type { PNode } from "./types";

const KIND_LABEL = { root: "Question", option: "Option", step: "Step", outcome: "Outcome" };

export function Graph() {
  let viewport!: HTMLDivElement;
  const [view, setView] = createSignal({ x: 0, y: 0, k: 1 });
  const [hover, setHover] = createSignal<string | null>(null);

  const layout = createMemo(() => {
    const m = map();
    return m ? layoutMap(m) : null;
  });
  const degree = createMemo(() => (map() ? inDegree(map()!) : new Map<string, number>()));
  const focus = createMemo(() => {
    const m = map();
    const id = hover() ?? selected();
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
    const ro = new ResizeObserver(() => fitPending && fit());
    ro.observe(viewport);
    onCleanup(() => ro.disconnect());
  });

  // Drag the background to pan; a click without movement clears the selection.
  let drag: { x: number; y: number; vx: number; vy: number; moved: boolean } | null = null;
  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest(".node, .view-tools")) return;
    drag = { x: e.clientX, y: e.clientY, vx: view().x, vy: view().y, moved: false };
    viewport.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    setView((v) => ({ ...v, x: drag!.vx + dx, y: drag!.vy + dy }));
  };
  const onPointerUp = () => {
    if (drag && !drag.moved) {
      setSelected(null);
      setLinkFrom(null);
    }
    drag = null;
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

  const clickNode = (n: PNode) => {
    const from = linkFrom();
    if (from) {
      link(from, n.id);
      setLinkFrom(null);
      setSelected(n.id);
      return;
    }
    setSelected(n.id);
  };

  return (
    <div
      ref={viewport}
      class="viewport"
      classList={{ linking: !!linkFrom() }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
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
                <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" class="arrow" />
                </marker>
              </defs>
              <For each={map()!.edges}>
                {(e) => {
                  const a = () => l().boxes.get(e.from);
                  const b = () => l().boxes.get(e.to);
                  return (
                    <Show when={a() && b()}>
                      <path
                        d={edgePath(a()!, b()!)}
                        class="edge"
                        classList={{ lit: edgeLit(e.from, e.to), dim: !!focus() && !edgeLit(e.from, e.to) }}
                        marker-end="url(#arrow)"
                      />
                    </Show>
                  );
                }}
              </For>
            </svg>
            <For each={map()!.nodes}>
              {(n) => {
                const box = () => l().boxes.get(n.id);
                const paths = () => degree().get(n.id) ?? 0;
                return (
                  <Show when={box()}>
                    <div
                      class={`node kind-${n.kind} status-${n.status}`}
                      classList={{
                        selected: selected() === n.id,
                        dim: !lit(n.id),
                        converge: paths() > 1,
                        fresh: fresh().has(n.id),
                        busy: busy() === n.id,
                        "link-source": linkFrom() === n.id,
                      }}
                      style={{
                        left: `${box()!.x}px`,
                        top: `${box()!.y}px`,
                        width: `${box()!.w}px`,
                        height: `${box()!.h}px`,
                      }}
                      onClick={() => clickNode(n)}
                      onPointerEnter={() => setHover(n.id)}
                      onPointerLeave={() => setHover(null)}
                    >
                      <div class="node-head">
                        <span class="kind">{KIND_LABEL[n.kind]}</span>
                        <Show when={n.missed}>
                          <span class="badge missed" title="The agent thinks you may not have considered this">
                            new angle
                          </span>
                        </Show>
                        <Show when={paths() > 1}>
                          <span class="badge converge" title="Several paths arrive here">
                            {paths()} paths meet
                          </span>
                        </Show>
                        <Show when={n.status === "chosen"}>
                          <span class="badge chosen">chosen</span>
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
                  </Show>
                );
              }}
            </For>
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
