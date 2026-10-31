import { createEffect, createSignal, on } from "solid-js";
import { boundsOf } from "./map-layout";
import type { MapState } from "./createMapState";
import type { MapView } from "./createMapView";

/** Roving focus, and how a pick or a toggle keeps the map steady. */
export const createMapFocus = (
  state: MapState,
  view: MapView,
  onSelect: (cardId: string) => void,
) => {
  const [focused, setFocused] = createSignal("root");
  // A live update can remove the focused card; the tree must keep one tab stop.
  const current = () =>
    state.layout().byId.has(focused()) ? focused() : state.tree().root.id;

  const element = (id: string) =>
    document.querySelector<HTMLElement>(
      `[data-testid=research-map] [data-node-id="${CSS.escape(id)}"]`,
    );

  const moveTo = (id: string, takeFocus = true) => {
    setFocused(id);
    const box = state.layout().byId.get(id);
    if (box) view.reveal(box);
    // The viewport clips; a browser scroll here would fight the pan.
    if (takeFocus) element(id)?.focus({ preventScroll: true });
  };

  /** Opens or closes a branch with the node held still, then shows what opened. */
  const setBranch = (id: string, value: boolean) => {
    const before = state.layout().byId.get(id);
    view.glide(() => {
      state.setBranch(id, value);
      const after = state.layout().byId.get(id);
      if (before && after) view.nudge(before.x - after.x, before.y - after.y);
    });
    const node = state.tree().byId.get(id);
    const shown = (value ? node?.children ?? [] : []).flatMap(
      (kid) => state.layout().byId.get(kid.id) ?? [],
    );
    const self = state.layout().byId.get(id);
    if (self) view.reveal(boundsOf([self, ...shown]));
  };

  const toggle = (id: string) => setBranch(id, !state.isOpen(id));

  /** Shows a picked node with its parent; if both cannot fit, the node wins. */
  const showPick = (id: string) => {
    const { byId } = state.layout();
    const box = byId.get(id);
    if (!box) return;
    const parent = byId.get(state.tree().byId.get(id)?.parentId ?? "");
    if (parent) view.reveal(boundsOf([parent, box]));
    view.reveal(box);
  };

  let centering: string | null = null;
  const centerOn = (id: string) => {
    const box = state.layout().byId.get(id);
    if (box) view.center(box);
  };

  /** Opens the next search match. Focus stays in the search field. */
  const stepMatch = (step: 1 | -1) => {
    const node = state.nextMatch(step);
    if (!node?.card) return;
    if (state.selectedNode() === node.id) return centerOn(node.id);
    centering = node.id;
    onSelect(node.card.id);
  };

  const pick = (id: string) => {
    const node = state.tree().byId.get(id);
    if (!node || node.kind === "root") return;
    setFocused(id);
    if (node.card) {
      onSelect(node.card.id);
      if (node.children.length && !state.isOpen(id)) setBranch(id, true);
      return;
    }
    toggle(id);
  };

  // Next and previous in the reader walk the map too. The rail may have just
  // opened, so wait a frame for the viewport's new width.
  createEffect(
    on(
      state.selectedNode,
      (id) => {
        if (!id) return;
        setFocused(id);
        const center = centering === id;
        centering = null;
        requestAnimationFrame(() => (center ? centerOn(id) : showPick(id)));
      },
      { defer: true },
    ),
  );

  /** Keeps the tab stop on a node that got focus some other way. */
  const track = (target: EventTarget) => {
    const id = (target as HTMLElement).closest<HTMLElement>("[data-node-id]")
      ?.dataset.nodeId;
    if (id) setFocused(id);
  };

  return { current, moveTo, toggle, pick, stepMatch, track };
};
