import { useAction } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { css } from "styled-system/css";
import { setResearchCardNudge, setResearchSummaryStatus } from "~/services/research/research.actions";
import { createCanvasStore } from "~/stores/canvas.store";
import type { TopicData } from "../createTopicData";
import { foldView, levelForScale } from "../layout/fold";
import type { Rect } from "../layout/tree-layout";
import { CanvasCardNode } from "./CanvasCardNode";
import { CanvasEdges } from "./CanvasEdges";
import { CanvasHulls } from "./CanvasHulls";
import { CanvasLanes } from "./CanvasLanes";
import { CanvasToolbar } from "./CanvasToolbar";
import { createCanvasModel } from "./createCanvasModel";

const viewportClass = css({
  position: "relative",
  w: "full",
  h: "full",
  overflow: "hidden",
  bg: "gray.1",
  touchAction: "none",
  cursor: "grab",
  "&[data-panning=true]": { cursor: "grabbing" },
});

const DRAG_THRESHOLD = 4;
/** Below this, 13px card titles drop under ~8px on screen. */
const READABLE_SCALE = 0.62;

type Drag = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  moved: boolean;
  base: { x: number; y: number };
};

export const TopicCanvas = (props: {
  data: TopicData;
  selectedId: string | null;
  /** Search matches; null shows everything at full strength. */
  matches: Set<string> | null;
  onSelect: (cardId: string | null) => void;
}) => {
  const store = createCanvasStore();
  const runNudge = useAction(setResearchCardNudge);
  const runSummaryStatus = useAction(setResearchSummaryStatus);
  let viewport: HTMLDivElement | undefined;

  // Zoom bands only cover accepted summary layers: drafts never fold.
  const acceptedMax = createMemo(
    () => foldView({ cards: props.data.cards(), groups: props.data.current()?.groups ?? [], level: 0 }).maxLevel,
  );
  const level = createMemo(() => levelForScale(store.scale(), acceptedMax()));
  // Layout matches the viewport's shape; stepped so small resizes do not reflow it.
  const [aspect, setAspect] = createSignal(1.4);
  // All three are read lazily inside the model's memos; data is a stable object.
  // eslint-disable-next-line solid/reactivity
  const model = createCanvasModel(props.data, level, aspect);
  const drafts = createMemo(() => (props.data.current()?.groups ?? []).filter((g) => g.status === "draft"));

  const [drag, setDrag] = createSignal<Drag | null>(null);

  // A visible node matches when its card or any card folded into it matches.
  const matchedNodes = createMemo(() => {
    const ids = props.matches;
    if (!ids) return null;
    const rep = model.view().rep;
    return new Set([...ids].map((id) => rep.get(id)).filter((id): id is string => !!id));
  });

  // Selection from the inspector or outline: bring the card (or the summary
  // folding it) into view when it is off screen. Clicks on the canvas never move it.
  createEffect(
    on(
      () => props.selectedId,
      (id) => {
        if (!id || !viewport) return;
        const nodeId = model.view().rep.get(id) ?? id;
        const rect = model.layout().rects.get(nodeId);
        if (!rect) return;
        const s = store.scale();
        const t = store.offset();
        const { w, h } = viewportSize();
        const left = t.x + rect.x * s;
        const top = t.y + rect.y * s;
        const inView = left >= 0 && top >= 0 && left + rect.w * s <= w && top + rect.h * s <= h;
        if (inView) return;
        store.animateToView({
          scale: s,
          offset: { x: w / 2 - (rect.x + rect.w / 2) * s, y: h / 2 - (rect.y + rect.h / 2) * s },
        });
      },
      { defer: true },
    ),
  );
  const nodeById = createMemo(() => new Map(model.view().nodes.map((node) => [node.id, node])));
  const nodeIds = createMemo(() => model.view().nodes.map((node) => node.id));

  const rectFor = (id: string): Rect | undefined => {
    const rect = model.layout().rects.get(id);
    const active = drag();
    if (!rect || !active || active.id !== id) return rect;
    return { ...rect, x: rect.x + active.dx, y: rect.y + active.dy };
  };

  const edgeRects = createMemo(() => {
    const out = new Map<string, Rect>();
    for (const id of model.layout().rects.keys()) out.set(id, rectFor(id)!);
    return out;
  });

  const viewportSize = () => ({ w: viewport?.clientWidth ?? 1200, h: viewport?.clientHeight ?? 800 });

  // Fit to the shallowest fold level whose own layout fits at a scale inside
  // that level's zoom band, so a big topic opens on readable summaries. The
  // first view never opens below a readable scale; it starts at the top left
  // and the rest is a pan (or Fit) away.
  const fit = (animate = true, minScale = 0) => {
    const { w, h } = viewportSize();
    const fitScale = (bounds: Rect) => Math.max(0.2, Math.min(1, Math.min((w - 80) / bounds.w, (h - 96) / bounds.h)));
    let chosen: { bounds: Rect; scale: number } | null = null;
    for (let candidate = 0; candidate <= acceptedMax(); candidate++) {
      const bounds = candidate === level() ? model.layout().bounds : model.boundsAtLevel(candidate);
      if (!bounds.w || !bounds.h) continue;
      const scale = fitScale(bounds);
      chosen = { bounds, scale };
      if (levelForScale(scale, acceptedMax()) <= candidate) break;
    }
    if (!chosen) return;
    const { bounds } = chosen;
    const scale = Math.max(chosen.scale, minScale);
    const fitsWide = bounds.w * scale <= w - 80;
    const offset = {
      x: fitsWide ? (w - bounds.w * scale) / 2 - bounds.x * scale : 24 - bounds.x * scale,
      y: 64 - bounds.y * scale,
    };
    if (animate) store.animateToView({ scale, offset });
    else store.setView({ scale, offset });
  };

  const center = () => {
    const { w, h } = viewportSize();
    return { x: w / 2, y: h / 2 };
  };

  // Keep the card nearest the viewport center in place when a fold level switches.
  let lastRects: Map<string, Rect> | null = null;
  createEffect(
    on(level, (_next, prev) => {
      const rects = model.layout().rects;
      if (prev !== undefined && lastRects) {
        const s = store.scale();
        const t = store.offset();
        const c = center();
        let anchorId: string | null = null;
        let best = Infinity;
        for (const [id, rect] of lastRects) {
          const sx = t.x + (rect.x + rect.w / 2) * s;
          const sy = t.y + (rect.y + rect.h / 2) * s;
          const distance = Math.hypot(sx - c.x, sy - c.y);
          if (distance < best) {
            best = distance;
            anchorId = id;
          }
        }
        const before = anchorId ? lastRects.get(anchorId) : undefined;
        const view = model.view();
        const group = props.data.current()?.groups.find((g) => g.summaryCardId === anchorId);
        const afterId =
          (anchorId && view.rep.get(anchorId)) ??
          group?.memberIds.map((id) => view.rep.get(id)).find((id) => id !== undefined) ??
          null;
        const after = afterId ? rects.get(afterId) : undefined;
        if (before && after) {
          store.setOffset({
            x: t.x + (before.x + before.w / 2 - (after.x + after.w / 2)) * s,
            y: t.y + (before.y + before.h / 2 - (after.y + after.h / 2)) * s,
          });
        }
      }
      lastRects = rects;
    }),
  );
  createEffect(() => {
    lastRects = model.layout().rects;
  });

  const localPoint = (event: { clientX: number; clientY: number }) => {
    const box = viewport!.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  onMount(() => {
    const measure = () => {
      const { w, h } = viewportSize();
      if (w && h) setAspect(Math.round((w / h) * 4) / 4 || 0.25);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport!);
    onCleanup(() => observer.disconnect());
    fit(false, READABLE_SCALE);
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const intensity = event.ctrlKey ? 0.01 : 0.0015;
      store.zoomAt(localPoint(event), Math.exp(-event.deltaY * intensity));
    };
    viewport!.addEventListener("wheel", onWheel, { passive: false });
    onCleanup(() => viewport?.removeEventListener("wheel", onWheel));
  });

  // Background drag pans; a click without movement clears the selection.
  let pan: { pointerId: number; x: number; y: number; moved: boolean } | null = null;
  const onViewportPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    store.cancelMotion();
    pan = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    viewport!.setPointerCapture(event.pointerId);
    store.setIsPanning(true);
  };

  const onCardPointerDown = (id: string, event: PointerEvent) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const card = props.data.cardsById().get(id);
    viewport!.setPointerCapture(event.pointerId);
    setDrag({
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
      moved: false,
      base: { x: card?.nudgeX ?? 0, y: card?.nudgeY ?? 0 },
    });
  };

  const onPointerMove = (event: PointerEvent) => {
    const active = drag();
    if (active && active.pointerId === event.pointerId) {
      const dx = event.clientX - active.startX;
      const dy = event.clientY - active.startY;
      const moved = active.moved || Math.hypot(dx, dy) > DRAG_THRESHOLD;
      const s = store.scale();
      setDrag({ ...active, moved, dx: moved ? dx / s : 0, dy: moved ? dy / s : 0 });
      return;
    }
    if (pan && pan.pointerId === event.pointerId) {
      const dx = event.clientX - pan.x;
      const dy = event.clientY - pan.y;
      if (Math.hypot(dx, dy) > 1) pan.moved = true;
      pan.x = event.clientX;
      pan.y = event.clientY;
      store.panBy(dx, dy);
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    const active = drag();
    if (active && active.pointerId === event.pointerId) {
      setDrag(null);
      if (!active.moved) {
        props.onSelect(active.id);
        return;
      }
      // Nudges are stored in base (level 0) units.
      const k = model.factor();
      const next = { x: active.base.x + active.dx / k, y: active.base.y + active.dy / k };
      model.setLocalNudge(active.id, next);
      void runNudge({ id: active.id, x: next.x, y: next.y });
      return;
    }
    if (pan && pan.pointerId === event.pointerId) {
      if (!pan.moved) props.onSelect(null);
      pan = null;
      store.setIsPanning(false);
    }
  };

  const accept = async (groupId: string) => {
    await runSummaryStatus({ groupId, status: "accepted" });
    props.data.reload();
  };

  return (
    <div
      ref={viewport}
      class={viewportClass}
      data-panning={store.isPanning()}
      data-testid="research-canvas"
      data-level={level()}
      onPointerDown={onViewportPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        class={css({ position: "absolute", left: 0, top: 0, transformOrigin: "0 0" })}
        style={{ transform: `translate(${store.offset().x}px, ${store.offset().y}px) scale(${store.scale()})` }}
      >
        <CanvasHulls
          hulls={model.layout().hulls}
          factor={model.factor()}
          selectedId={props.selectedId}
          onSelect={(id) => props.onSelect(id)}
          onAccept={accept}
        />
        <CanvasLanes lanes={model.layout().lanes} factor={model.factor()} />
        <CanvasEdges
          view={model.view()}
          rects={edgeRects()}
          lanes={model.layout().lanes}
          laned={model.layout().laned}
          factor={model.factor()}
          selectedId={props.selectedId}
        />
        {/* Keyed by id so cards keep their DOM across folds and slide to new spots. */}
        <For each={nodeIds()}>
          {(id) => (
            <Show when={nodeById().get(id)}>
              {(node) => (
                <CanvasCardNode
                  node={node()}
                  rect={rectFor(id) ?? { x: 0, y: 0, w: 0, h: 0 }}
                  factor={model.factor()}
                  selected={props.selectedId === id}
                  dimmed={!!matchedNodes() && !matchedNodes()!.has(id)}
                  dragging={drag()?.id === id && !!drag()?.moved}
                  onPointerDown={(event) => onCardPointerDown(id, event)}
                />
              )}
            </Show>
          )}
        </For>
      </div>
      <CanvasToolbar
        level={level()}
        maxLevel={acceptedMax()}
        draftCount={drafts().length}
        onReviewDrafts={() => {
          // Step through drafts: the one after the selected draft, else the first.
          const list = drafts();
          const at = list.findIndex((group) => group.summaryCardId === props.selectedId);
          props.onSelect(list[(at + 1) % list.length].summaryCardId);
        }}
        scale={store.scale()}
        onLevel={(scale) => store.animateZoomAt(center(), scale / store.scale())}
        onFit={() => fit()}
      />
    </div>
  );
};
