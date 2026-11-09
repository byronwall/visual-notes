import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { inDegree, isFaint, layoutMap, lineage } from "./layout";
import { fitText } from "./textfit";
import { useRoutes } from "./useRoutes";
import { busy, fitTick, freshEdges, freshNodes, link, linkFrom, map, selected, setLinkFrom, setSelected, setTitleFocus } from "./state";
import type { PNode } from "./types";

const KIND_LABEL = { root: "Question", option: "Option", step: "Step", outcome: "Outcome" };
const MIN_PX = 12;
const BADGE_PX = 10;
const FAR_IN = 0.7;
const FAR_OUT = 0.85;
const VOTE_LABEL = { like: "♥ like", no: "✕ not for me", more: "↻ want better" };
const RESEARCH_LABEL = { suggested: "needs research", queued: "queued", running: "researching…", done: "researched" };

export function Graph() {
  // Hover peek: below full detail, show the hovered card's full text at screen size.
  const Peek = () => {
    const info = createMemo(() => {
      const id = peekId();
      const l = layout();
      const v = view();
      if (!id || !l || v.k >= 0.9 || panning() || moving()) return null;
      const n = map()?.nodes.find((x) => x.id === id);
      const b = l.boxes.get(id);
      if (!n || !b) return null;
      const right = v.x + (b.x + b.w) * v.k + 10;
      const vw = viewport?.clientWidth ?? 0;
      const left = right + 300 > vw ? v.x + b.x * v.k - 310 : right;
      return { n, left, top: Math.max(8, v.y + b.y * v.k) };
    });
    return (
      <Show when={info()}>
        {(i) => (
          <div class="peek" style={{ left: `${i().left}px`, top: `${i().top}px` }}>
            <div class="kind">{KIND_LABEL[i().n.kind]}</div>
            <div class="peek-title">{i().n.title}</div>
            <Show when={i().n.note}>
              <div class="peek-note">{i().n.note}</div>
            </Show>
            <Show when={i().n.feedback?.comment}>
              <div class="peek-note">Your take: {i().n.feedback!.comment}</div>
            </Show>
          </div>
        )}
      </Show>
    );
  };

  let viewport!: HTMLDivElement;
  const [view, setView] = createSignal({ x: 0, y: 0, k: 1 });
  const [hover, setHover] = createSignal<string | null>(null);
  const [panning, setPanning] = createSignal(false);
  // Viewport size in 40px steps, so the packed layout does not redo on every pixel.
  const [size, setSize] = createSignal({ w: 1200, h: 800 });

  // Below FAR_IN zoom the map switches to a title-only layout with bigger
  // cards; above FAR_OUT it switches back. The gap stops it flapping.
  const [far, setFar] = createSignal(false);
  const layout = createMemo(() => {
    const m = map();
    return m ? layoutMap(m, size().w, size().h, far()) : null;
  });
  const paths = useRoutes(layout, map);
  // Zoom in ~9% steps for text fitting and stroke widths, so a wheel tick
  // does not refit every card.
  const kb = createMemo(() => 2 ** (Math.round(Math.log2(view().k) * 8) / 8));
  // While moving, the canvas gets its own compositor layer; at rest it re-rasterizes crisp.
  const [moving, setMoving] = createSignal(false);
  let stillTimer: ReturnType<typeof setTimeout> | undefined;
  // One view update per frame, however many wheel or pointer events arrive.
  let queued: { x: number; y: number; k: number } | null = null;
  let raf = 0;
  const current = () => queued ?? view();
  const schedule = (v: { x: number; y: number; k: number }) => {
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
  const degree = createMemo(() => (map() ? inDegree(map()!) : new Map<string, number>()));
  // The peek waits until the pointer rests on a card and the view is still,
  // so it does not flicker in and out while zooming or panning.
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
    const m = map();
    const r = viewport?.getBoundingClientRect();
    if (!m || !r?.width || !r.height) return void (fitPending = true);
    fitPending = false;
    const scale = (l: { width: number; height: number }) => Math.min(1.1, r.width / l.width, r.height / l.height);
    // Use the detailed layout when it fits at a readable zoom, else the far one.
    const near = layoutMap(m, size().w, size().h, false);
    setFar(scale(near) < FAR_IN);
    const l = layout()!;
    const k = scale(l);
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
    // preventDefault stops the browser's own blur, so save any open text field here.
    (document.activeElement as HTMLElement | null)?.blur?.();
    const node = (el.closest(".node") as HTMLElement | null)?.dataset.id ?? null;
    drag = { x: e.clientX, y: e.clientY, vx: current().x, vy: current().y, moved: false, node };
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
    const v = current();
    if (e.ctrlKey || e.metaKey) {
      const r = viewport.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const k = Math.min(2, Math.max(0.1, v.k * Math.exp(-e.deltaY * 0.01)));
      const next = { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
      const toFar = !far() && k < FAR_IN;
      const toNear = far() && k > FAR_OUT;
      if (!toFar && !toNear) return void schedule(next);
      // Switch layouts and keep the card nearest the cursor under the cursor.
      const before = layout()!;
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
      // Same zoom, so the far layout's bigger cards read larger; the map spreads out to match.
      const now = layout()!.boxes.get(anchor);
      schedule(now ? { k, x: px - (now.x + fx * now.w) * k, y: py - (now.y + fy * now.h) * k } : next);
    } else {
      schedule({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
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
      onDblClick={(e) => {
        const id = ((e.target as HTMLElement).closest(".node") as HTMLElement | null)?.dataset.id;
        if (!id) return;
        setSelected(id);
        queueMicrotask(() => setTitleFocus((t) => t + 1));
      }}
      onWheel={onWheel}
    >
      <Show when={layout()}>
        {(l) => (
          <div
            class="canvas"
            classList={{ moving: moving() }}
            style={{
              width: `${l().width}px`,
              height: `${l().height}px`,
              transform: `translate(${view().x}px, ${view().y}px) scale(${view().k})`,
              "--k": String(kb()),
            }}
          >
            <svg class="edges" width={l().width} height={l().height}>
              <defs>
                <marker id="arrow" viewBox="0 0 8 8" markerWidth="6" markerHeight="6" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M1 1L7 4L1 7" class="arrow" />
                </marker>
                <marker id="arrow-lit" viewBox="0 0 8 8" markerWidth="5" markerHeight="5" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M1 1L7 4L1 7" class="arrow lit" />
                </marker>
              </defs>
              <For each={map()!.edges}>
                {(e) => {
                  const d = () => paths().get(`${e.from}>${e.to}`);
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
            <For each={map()!.nodes}>{(n) => <Card n={n} box={l().boxes.get(n.id)} paths={degree().get(n.id) ?? 0} lit={lit(n.id)} k={kb()} far={far()} onHover={setHover} />}</For>
          </div>
        )}
      </Show>
      <Peek />
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
  k: number;
  far: boolean;
  onHover: (id: string | null) => void;
}) {
  const n = props.n;
  // Level of detail by zoom. Below full detail the type label and note hide,
  // and the title grows to fill the card (see fitText), in as many
  // lines as the card's fixed height allows. Layout never changes with zoom.
  const lod = () => (props.far ? "far" : props.k >= 0.9 ? "full" : "mid");
  const fit = createMemo(() => {
    const b = props.box;
    if (!b || lod() === "full") return null;
    const k = props.k;
    const pad = lod() === "far" ? 6 : 8;
    const badges = freshNodes().has(n.id) || props.paths > 1 || !!n.feedback || !!n.research || n.missed || n.status === "chosen";
    // Content box: card minus padding and borders (4-6px left rail, 1-2px others), with 3% slack.
    const textW = (b.w - 2 * (pad + 2) - 8) * 0.97;
    // Fill the card: the largest title that fits, never under MIN_PX on screen.
    // Badges scale with the title (half its size, at least BADGE_PX on screen).
    const floor = MIN_PX / k;
    const solve = (badgeF: number) => {
      const headH = badges ? badgeF * 1.4 + 4 : 0;
      const room = Math.max(8, b.h - 2 * pad - headH - 4);
      return { headH, room, size: fitText(n.title, textW, room, 650, 64 / k) };
    };
    let badgeF = BADGE_PX / k;
    let r = solve(badgeF);
    if (badges && r.size * 0.5 > badgeF) {
      badgeF = r.size * 0.5;
      r = solve(badgeF);
    }
    const { headH, room } = r;
    const size = Math.max(r.size, Math.min(floor, room / 1.2));
    const lines = Math.max(1, Math.floor(room / (size * 1.2)));
    return { pad, badgeF, headH, size, lines, badges };
  });
  return (
    <Show when={props.box}>
      {(box) => (
        <div
          data-id={n.id}
          class={`node kind-${n.kind} status-${n.status} lod-${lod()}`}
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
          style={{
            left: `${box().x}px`,
            top: `${box().y}px`,
            width: `${box().w}px`,
            height: `${box().h}px`,
            padding: fit() ? `${fit()!.pad}px ${fit()!.pad + 2}px` : undefined,
          }}
          onPointerEnter={() => props.onHover(n.id)}
          onPointerLeave={() => props.onHover(null)}
        >
          <div
            class="node-head"
            style={fit() ? { "font-size": `${fit()!.badgeF}px`, height: `${fit()!.headH - 4}px`, display: fit()!.badges ? undefined : "none" } : undefined}
          >
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
          <div
            class="title"
            style={
              fit()
                ? { "font-size": `${fit()!.size}px`, "line-height": `${fit()!.size * 1.2}px`, "-webkit-line-clamp": String(fit()!.lines) }
                : undefined
            }
          >
            {n.title}
          </div>
          <Show when={n.note}>
            <div class="note">{n.note}</div>
          </Show>
        </div>
      )}
    </Show>
  );
}
