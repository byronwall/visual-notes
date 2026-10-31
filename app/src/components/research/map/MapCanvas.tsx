import { createEffect, For, on, onCleanup, onMount, Show } from "solid-js";
import { css } from "styled-system/css";
import { createMapHover } from "./MapHoverCard";
import { mapMove } from "./map-keys";
import { boundsOf } from "./map-layout";
import { MapLinks } from "./MapLinks";
import { MapNodeView } from "./MapNodeView";
import { MapToolbar } from "./MapToolbar";
import { createMapFocus } from "./createMapFocus";
import type { MapState } from "./createMapState";
import { createMapView } from "./createMapView";

const SEARCH_SETTLE_MS = 250;

/** The desktop map: a pannable world of fixed-size nodes joined by curves. */
export const MapCanvas = (props: {
  state: MapState;
  query: string;
  onQuery: (query: string) => void;
  onSelect: (cardId: string) => void;
  onSelectStream: (key: string) => void;
}) => {
  const view = createMapView();
  const hover = createMapHover(() => props.state.tree());
  // The state object lives as long as the map, so reading it once is safe.
  // oxlint-disable-next-line solid/reactivity
  const focus = createMapFocus(props.state, view, (id) => props.onSelect(id));
  const ids = () => props.state.layout().boxes.map((box) => box.id);
  const worldTransform = () =>
    `translate(${view.pan().x}px, ${view.pan().y}px) scale(${view.zoom()})`;
  let viewport: HTMLDivElement | undefined;

  const fitAll = () => view.fit(props.state.layout().bounds);
  onMount(() => {
    view.attach(viewport!);
    // A share link can open deep branches; the first view still shows them all.
    const { bounds } = props.state.layout();
    if (bounds.w > viewport!.clientWidth || bounds.h > viewport!.clientHeight)
      fitAll();
  });

  // A search frames what it found once typing settles; clearing it frames the map.
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(searchTimer));
  createEffect(
    on(
      // The text, not the hits: a live update must not re-frame the view.
      () => props.query,
      () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          const counts = props.state.matchCounts();
          const { boxes, byId } = props.state.layout();
          const hits = counts
            ? [...counts.keys()].flatMap((id) => byId.get(id) ?? [])
            : boxes;
          if (hits.length) view.fit(boundsOf(hits));
        }, SEARCH_SETTLE_MS);
      },
      { defer: true },
    ),
  );

  const onKeyDown = (event: KeyboardEvent) => {
    const id = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-node-id]",
    )?.dataset.nodeId;
    // Cmd+← and Alt+← stay the browser's back shortcut.
    if (!id || event.metaKey || event.altKey || event.ctrlKey) return;
    if (event.key === "Enter" && event.shiftKey) {
      const key = props.state.tree().byId.get(id)?.streamKey;
      if (!key) return;
      event.preventDefault();
      props.onSelectStream(key);
      return;
    }
    const move = mapMove(
      event.key,
      id,
      props.state.tree(),
      props.state.layout(),
      props.state.openIds(),
      props.state.searchOpen(),
    );
    const handled = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "Enter",
      " ",
    ];
    if (handled.includes(event.key)) event.preventDefault();
    if (!move) return;
    hover.hide();
    if ("to" in move) focus.moveTo(move.to);
    else if ("toggle" in move) focus.toggle(move.toggle);
    else focus.pick(move.activate);
  };

  return (
    <div class={css({ display: "flex", flexDirection: "column", h: "full" })}>
      <MapToolbar
        query={props.query}
        found={props.state.foundCount()}
        matchAt={props.state.matchAt()}
        onQuery={props.onQuery}
        onStep={(step) => {
          clearTimeout(searchTimer);
          hover.hide();
          focus.stepMatch(step);
        }}
        onExpandAll={() => {
          props.state.expandAll();
          fitAll();
        }}
        onCollapseAll={() => {
          focus.moveTo(props.state.tree().root.id, false);
          props.state.collapseAll();
          fitAll();
        }}
        onZoomOut={() => view.zoomBy(0.8)}
        onZoomIn={() => view.zoomBy(1.25)}
        onFit={fitAll}
      />
      <div
        ref={viewport}
        class={css({
          position: "relative",
          flex: 1,
          minH: 0,
          overflow: "hidden",
          touchAction: "none",
          userSelect: "none",
          cursor: "grab",
          "&[data-dragging=true]": { cursor: "grabbing" },
        })}
        data-testid="research-map"
        data-dragging={view.dragging()}
        data-gliding={view.gliding()}
        onPointerDown={(event) => {
          hover.hide();
          view.onPointerDown(event);
        }}
        onPointerOver={hover.onPointerOver}
        onPointerLeave={hover.hide}
        onFocusIn={(event) => {
          focus.track(event.target);
          hover.onFocusIn(event);
        }}
        onFocusOut={hover.hide}
        onWheel={hover.hide}
      >
        <div
          role="tree"
          aria-label="Topic map"
          class={css({
            position: "absolute",
            left: "50%",
            top: "50%",
            w: 0,
            h: 0,
            transformOrigin: "0 0",
            "[data-gliding=true] &": {
              transitionProperty: "transform",
              transitionDuration: "180ms",
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            },
            "@media (prefers-reduced-motion: reduce)": {
              transitionProperty: "none",
            },
          })}
          style={{ transform: worldTransform() }}
          onKeyDown={onKeyDown}
        >
          <MapLinks state={props.state} />
          <For each={ids()}>
            {(id) => (
              <Show
                when={
                  props.state.tree().byId.get(id) &&
                  props.state.layout().byId.get(id)
                }
              >
                <MapNodeView
                  node={props.state.tree().byId.get(id)!}
                  box={props.state.layout().byId.get(id)!}
                  open={props.state.isOpen(id)}
                  focused={focus.current() === id}
                  selected={props.state.selectedNode() === id}
                  dimmed={props.state.isDimmed(id)}
                  query={props.query}
                  matches={
                    props.state.matchCounts()
                      ? props.state.matchCounts()!.get(id) ?? 0
                      : undefined
                  }
                  onPick={() => focus.pick(id)}
                  onToggle={() => focus.toggle(id)}
                />
              </Show>
            )}
          </For>
        </div>
        <hover.Card />
      </div>
    </div>
  );
};
