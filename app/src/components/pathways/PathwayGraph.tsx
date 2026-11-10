import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { frontier } from "~/lib/pathways/frontier";
import type { NodeStatus } from "~/lib/pathways/types";
import { fitCards } from "./card-fit";
import { viewport as viewportClass } from "./graph-styles";
import { isFaint, layoutMap, lineage } from "./layout";
import { PathwayCard } from "./PathwayCard";
import { usePathway } from "./pathway-state";
import { smallButton } from "./styles";
import { useRoutes } from "./useRoutes";

const KIND_LABEL = {
  root: "Question",
  option: "Option",
  step: "Step",
  outcome: "Outcome",
};
/** Below this zoom the map switches to the far (title-only) layout... */
const FAR_IN = 0.7;
/** ...and above this it switches back. The gap stops it flapping. */
const FAR_OUT = 0.85;

type View = { x: number; y: number; k: number };

/**
 * The pan-and-zoom map. Rendered only in the browser (PathwayPage gates it):
 * layout measures text on a canvas, routes edges in a Web Worker, and sizes
 * itself to the viewport, none of which exist during SSR.
 */
export function PathwayGraph() {
  const s = usePathway();
  // Done and dropped cards hide unless their toggle shows them. The map
  // joins a done card's parents to its children (see frontier).
  const [showDropped, setShowDropped] = createSignal(false);
  const [showDone, setShowDone] = createSignal(false);
  const count = (status: NodeStatus) =>
    s.record().graph.nodes.filter((n) => n.status === status).length;
  const dropped = createMemo(() => count("dropped"));
  const done = createMemo(() => count("done"));
  const graph = createMemo(() =>
    frontier(s.record().graph, { done: showDone(), dropped: showDropped() }),
  );
  let viewport!: HTMLDivElement;
  const [view, setView] = createSignal<View>({ x: 0, y: 0, k: 1 });
  const [hover, setHover] = createSignal<string | null>(null);
  const [panning, setPanning] = createSignal(false);
  // Viewport size in 40px steps, so the packed layout does not redo on every pixel.
  const [size, setSize] = createSignal({ w: 1200, h: 800 });
  const [far, setFar] = createSignal(false);
  // Lanes group each first-level option with what follows only from it.
  const [lanes, setLanes] = createSignal(true);

  const layout = createMemo(() =>
    layoutMap(graph(), size().w, size().h, far(), lanes()),
  );
  const { paths, prefetch } = useRoutes(layout, graph);
  // Once this layout is up, route the other zoom layout in the background,
  // so crossing the zoom switch shows finished edges right away.
  createEffect(
    on(layout, () => {
      const g = graph();
      const t = setTimeout(
        () => prefetch(layoutMap(g, size().w, size().h, !far(), lanes()), g),
        600,
      );
      onCleanup(() => clearTimeout(t));
    }),
  );
  // Zoom in ~9% steps for text fitting and stroke widths, so a wheel tick does not refit every card.
  const kb = createMemo(() => 2 ** (Math.round(Math.log2(view().k) * 8) / 8));
  // While moving, the canvas gets its own compositor layer; at rest it re-rasterizes crisp.
  const [moving, setMoving] = createSignal(false);
  let stillTimer: ReturnType<typeof setTimeout> | undefined;
  // One view update per frame, however many wheel or pointer events arrive.
  let queued: View | null = null;
  let raf = 0;
  const current = () => queued ?? view();
  const schedule = (v: View) => {
    queued = v;
    setMoving(true);
    clearTimeout(stillTimer);
    stillTimer = setTimeout(() => setMoving(false), 160);
    raf ||= requestAnimationFrame(() => {
      raf = 0;
      if (queued) setView(queued);
      queued = null;
    });
  };
  onCleanup(() => {
    clearTimeout(stillTimer);
    cancelAnimationFrame(raf);
  });

  // Card id -> number of the first open Next steps task that moves it forward.
  const nextOf = createMemo(() => {
    const out = new Map<string, number>();
    (s.record().plan?.tasks.filter((t) => t.status === "todo") ?? []).forEach(
      (t, i) => {
        for (const id of t.nodeIds) if (!out.has(id)) out.set(id, i + 1);
      },
    );
    return out;
  });

  // Zoomed-out title sizes, shared per card class (see fitCards).
  const fits = createMemo(() => {
    const k = kb();
    if (!far() && k >= 0.9) return null;
    const boxes = layout().boxes;
    const fresh = s.freshNodes();
    const cards = graph().nodes.flatMap((n) => {
      const box = boxes.get(n.id);
      if (!box) return [];
      const badges =
        nextOf().has(n.id) ||
        fresh.has(n.id) ||
        !!n.feedback ||
        !!n.research ||
        !!n.missed ||
        !!n.after ||
        n.status === "chosen" ||
        n.status === "done";
      return [{ n, box, badges }];
    });
    return fitCards(cards, k, far());
  });

  // The peek waits until the pointer rests on a card and the view is still.
  const [peekId, setPeekId] = createSignal<string | null>(null);
  let peekTimer: ReturnType<typeof setTimeout> | undefined;
  createEffect(() => {
    const id = hover();
    const still = !moving() && !panning();
    clearTimeout(peekTimer);
    setPeekId(null);
    if (id && still) peekTimer = setTimeout(() => setPeekId(id), 350);
  });
  onCleanup(() => clearTimeout(peekTimer));
  const peek = createMemo(() => {
    const id = peekId();
    const v = view();
    if (!id || v.k >= 0.9 || panning() || moving()) return null;
    const n = graph().nodes.find((x) => x.id === id);
    const b = layout().boxes.get(id);
    if (!n || !b) return null;
    const right = v.x + (b.x + b.w) * v.k + 10;
    const left =
      right + 300 > (viewport?.clientWidth ?? 0)
        ? v.x + b.x * v.k - 310
        : right;
    return { n, left, top: Math.max(8, v.y + b.y * v.k) };
  });

  const focus = createMemo(() => {
    // A card that just left the map (marked done) keeps no focus: its
    // element is gone without a pointerleave, so hover can still hold its id.
    const shown = (id: string | null) =>
      id && graph().nodes.some((n) => n.id === id) ? id : null;
    const id = shown(panning() ? null : hover()) ?? shown(s.selected());
    return id ? lineage(graph(), id) : null;
  });
  const lit = (id: string) => {
    const f = focus();
    return !f || f.up.has(id) || f.down.has(id);
  };
  const edgeLit = (from: string, to: string) => {
    const f = focus();
    return (
      !!f &&
      ((f.up.has(from) && f.up.has(to)) || (f.down.has(from) && f.down.has(to)))
    );
  };

  // A fit asked for before the viewport has a size waits for the resize observer.
  let fitPending = true;
  const fit = () => {
    const r = viewport?.getBoundingClientRect();
    if (!r?.width || !r.height) return void (fitPending = true);
    fitPending = false;
    const scale = (l: { width: number; height: number }) =>
      Math.min(1.1, r.width / l.width, r.height / l.height);
    // Use the detailed layout when it fits at a readable zoom, else the far one.
    setFar(
      scale(layoutMap(graph(), size().w, size().h, false, lanes())) < FAR_IN,
    );
    const l = layout();
    const k = scale(l);
    setView({
      k,
      x: (r.width - l.width * k) / 2,
      y: (r.height - l.height * k) / 2,
    });
  };
  createEffect(on(s.fitTick, () => queueMicrotask(fit), { defer: true }));
  onMount(() => {
    const ro = new ResizeObserver(() => {
      const r = viewport.getBoundingClientRect();
      // Hidden (Next steps is showing): keep the current view for when it comes back.
      if (!r.width || !r.height) return;
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
  let drag: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    moved: boolean;
    node: string | null;
  } | null = null;
  const onPointerDown = (e: PointerEvent) => {
    const el = e.target as HTMLElement;
    if (e.button !== 0 || el.closest(".view-tools")) return;
    e.preventDefault();
    // preventDefault stops the browser's own blur, so save any open text field here.
    (document.activeElement as HTMLElement | null)?.blur?.();
    const node =
      (el.closest(".node") as HTMLElement | null)?.dataset.id ?? null;
    drag = {
      x: e.clientX,
      y: e.clientY,
      vx: current().x,
      vy: current().y,
      moved: false,
      node,
    };
    viewport.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    drag.moved = true;
    setPanning(true);
    schedule({ ...current(), x: drag.vx + dx, y: drag.vy + dy });
  };
  const onPointerUp = () => {
    if (drag && !drag.moved) {
      if (drag.node) {
        const from = s.linkFrom();
        if (from) {
          s.link(from, drag.node);
          s.setLinkFrom(null);
        }
        s.openCard(drag.node);
      } else {
        s.setSelected(null);
        s.setLinkFrom(null);
      }
    }
    drag = null;
    setPanning(false);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const v = current();
    // Line-mode wheels (Firefox) report lines, not pixels.
    const unit = e.deltaMode === 1 ? 16 : 1;
    const dx = e.deltaX * unit;
    const dy = e.deltaY * unit;
    const pinch = e.ctrlKey || e.metaKey;
    // Shift+wheel and sideways swipes pan. Everything else zooms: the mouse
    // wheel, two-finger scroll, and trackpad pinch (which arrives with ctrlKey).
    if (e.shiftKey && !pinch)
      return void schedule({ ...v, x: v.x - (dx || dy), y: v.y });
    if (!pinch && Math.abs(dx) > Math.abs(dy))
      return void schedule({ ...v, x: v.x - dx, y: v.y - dy });
    const r = viewport.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    // Pinch deltas are small; a wheel tick is ~100px, so it gets a gentler rate (~20% a tick).
    const rate = pinch ? 0.01 : 0.002;
    const k = Math.min(2, Math.max(0.1, v.k * Math.exp(-dy * rate)));
    const next = {
      k,
      x: px - ((px - v.x) * k) / v.k,
      y: py - ((py - v.y) * k) / v.k,
    };
    const toFar = !far() && k < FAR_IN;
    const toNear = far() && k > FAR_OUT;
    if (!toFar && !toNear) return void schedule(next);
    // Switch layouts and keep the card nearest the cursor under the cursor.
    const before = layout();
    const cx = (px - v.x) / v.k;
    const cy = (py - v.y) / v.k;
    let anchor = "";
    let best = Infinity;
    for (const [id, b] of before.boxes) {
      const d = Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy);
      if (d < best) [best, anchor] = [d, id];
    }
    const old = before.boxes.get(anchor)!;
    const fx = (cx - old.x) / old.w;
    const fy = (cy - old.y) / old.h;
    setFar(toFar);
    const now = layout().boxes.get(anchor);
    schedule(
      now
        ? {
            k,
            x: px - (now.x + fx * now.w) * k,
            y: py - (now.y + fy * now.h) * k,
          }
        : next,
    );
  };

  const node = (id: string) => graph().nodes.find((n) => n.id === id)!;
  const votes = createMemo(() => graph().nodes.some((n) => n.feedback?.vote));

  return (
    <div
      ref={viewport}
      class={viewportClass}
      data-linking={String(!!s.linkFrom())}
      data-panning={String(panning())}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDblClick={(e) => {
        const id = (
          (e.target as HTMLElement).closest(".node") as HTMLElement | null
        )?.dataset.id;
        if (!id) return;
        s.openCard(id);
        queueMicrotask(() => s.setTitleFocus((t) => t + 1));
      }}
      onWheel={onWheel}
    >
      <div
        class="canvas"
        data-moving={String(moving())}
        style={{
          width: `${layout().width}px`,
          height: `${layout().height}px`,
          transform: `translate(${view().x}px, ${view().y}px) scale(${view().k})`,
          "--k": String(kb()),
        }}
      >
        <For each={layout().lanes}>
          {(lane) => (
            <div
              class="lane"
              data-shared={String(lane.shared)}
              style={{
                left: `${layout().laneX[0]}px`,
                width: `${layout().laneX[1] - layout().laneX[0]}px`,
                top: `${lane.y}px`,
                height: `${lane.h}px`,
              }}
            >
              <Show when={lane.shared}>
                <span class="lane-label">Where paths meet</span>
              </Show>
            </div>
          )}
        </For>
        <svg class="edges" width={layout().width} height={layout().height}>
          <defs>
            <marker
              id="pw-arrow"
              viewBox="0 0 8 8"
              markerWidth="6"
              markerHeight="6"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M1 1L7 4L1 7" class="arrow" />
            </marker>
            <marker
              id="pw-arrow-lit"
              viewBox="0 0 8 8"
              markerWidth="5"
              markerHeight="5"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M1 1L7 4L1 7" class="arrow-lit" />
            </marker>
          </defs>
          {/* Keyed by "from>to": every save clones the graph, and object keys would rebuild every edge. */}
          <For each={graph().edges.map((e) => `${e.from}>${e.to}`)}>
            {(key) => {
              const [from, to] = key.split(">");
              const on = () => edgeLit(from, to);
              const faint = () =>
                graph().nodes.some(
                  (n) => (n.id === from || n.id === to) && isFaint(n),
                );
              return (
                <Show when={paths().get(key)}>
                  {(d) => (
                    <g
                      class="edge"
                      data-lit={String(on())}
                      data-dim={String(!!(!!focus() && !on()))}
                      data-fresh={String(s.freshEdges().has(key))}
                      data-faint={String(faint())}
                    >
                      <path d={d()} class="edge-halo" />
                      <path
                        d={d()}
                        class="edge-line"
                        marker-end={
                          on() ? "url(#pw-arrow-lit)" : "url(#pw-arrow)"
                        }
                      />
                    </g>
                  )}
                </Show>
              );
            }}
          </For>
        </svg>
        <For each={graph().nodes.map((n) => n.id)}>
          {(id) => (
            <PathwayCard
              n={node(id)}
              box={layout().boxes.get(id)}
              lit={lit(id)}
              k={kb()}
              far={far()}
              fit={fits()?.get(id)}
              next={nextOf().get(id)}
              onHover={setHover}
            />
          )}
        </For>
      </div>
      <Show when={peek()}>
        {(p) => (
          <div
            class="peek"
            style={{ left: `${p().left}px`, top: `${p().top}px` }}
          >
            <div class="kind">{KIND_LABEL[p().n.kind]}</div>
            <div class="peek-title">{p().n.title}</div>
            <Show when={p().n.note}>
              <div class="peek-note">{p().n.note}</div>
            </Show>
            <Show when={p().n.feedback?.comment}>
              <div class="peek-note">Your take: {p().n.feedback!.comment}</div>
            </Show>
            <Show when={p().n.after}>
              {(a) => (
                <div class="peek-note">
                  ✓ Done before this: {a().join(" · ")}
                </div>
              )}
            </Show>
          </div>
        )}
      </Show>
      <div class="view-tools">
        <button
          class={smallButton}
          onClick={fit}
          title="Fit the map to the window"
        >
          Fit
        </button>
        <button
          class={smallButton}
          aria-pressed={lanes()}
          data-on={String(lanes())}
          onClick={() => {
            setLanes((v) => !v);
            queueMicrotask(fit);
          }}
          title="Group each first choice with the cards that follow only from it"
        >
          Lanes
        </button>
        <Show when={dropped()}>
          <button
            class={smallButton}
            aria-pressed={showDropped()}
            onClick={() => {
              setShowDropped((v) => !v);
              queueMicrotask(fit);
            }}
            title="Dropped cards are hidden from the map"
          >
            {showDropped() ? "Hide dropped" : `Show ${dropped()} dropped`}
          </button>
        </Show>
        <Show when={done()}>
          <button
            class={smallButton}
            aria-pressed={showDone()}
            onClick={() => {
              setShowDone((v) => !v);
              queueMicrotask(fit);
            }}
            title="Done cards are hidden; the map joins the cards around them"
          >
            {showDone() ? "Hide done" : `Show ${done()} done`}
          </button>
        </Show>
        <span class="legend">
          <i data-kind="option" /> option <i data-kind="step" /> step{" "}
          <i data-kind="outcome" /> outcome
          <Show when={votes()}>
            <b data-vote="like" /> like <b data-vote="no" /> not for me{" "}
            <b data-vote="more" /> want better
          </Show>
        </span>
        <span class="hint">
          Drag to pan · scroll to zoom · double-click to edit
        </span>
      </div>
    </div>
  );
}
