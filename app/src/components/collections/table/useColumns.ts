import { createMemo, createSignal, type Accessor } from "solid-js";
import { orderedProperties, TITLE_PROPERTY } from "~/lib/collections/query";
import type {
  CollectionProperty,
  CollectionView,
} from "~/lib/collections/types";
import { TITLE_PROPERTY_ID } from "~/lib/collections/types";
import type { CollectionStore } from "../store/createCollectionStore";

export const DEFAULT_WIDTH = 180;
export const TITLE_WIDTH = 280;
export const SELECT_COLUMN = 32;
const ADD_COLUMN = 44;
/** Below this scroller width the name column gives room back to the data. */
const NARROW = 640;
const MIN_NARROW_TITLE = 120;

/**
 * Column order, widths, resizing, and drag reorder for the table. On a narrow
 * scroller the name column is clamped for layout only; the saved width is
 * never changed by that clamp.
 */
export function useColumns(opts: {
  store: CollectionStore;
  view: () => CollectionView;
  scrollerWidth: Accessor<number>;
}) {
  const [liveWidths, setLiveWidths] = createSignal<Record<string, number>>({});
  const [dragId, setDragId] = createSignal<string | null>(null);
  const [drop, setDrop] = createSignal<{
    id: string;
    side: "before" | "after";
  } | null>(null);

  const config = () => opts.view().config;
  const columns = createMemo<CollectionProperty[]>(() => [
    TITLE_PROPERTY,
    ...orderedProperties(opts.store.state.properties, config()),
  ]);

  const savedWidth = (id: string) =>
    liveWidths()[id] ??
    config().columnWidths?.[id] ??
    (id === TITLE_PROPERTY_ID ? TITLE_WIDTH : DEFAULT_WIDTH);
  const widthOf = (id: string) => {
    const saved = savedWidth(id);
    const w = opts.scrollerWidth();
    if (id !== TITLE_PROPERTY_ID || !w || w >= NARROW) return saved;
    return Math.min(saved, Math.max(MIN_NARROW_TITLE, Math.round(w * 0.4)));
  };
  // CSS lays out the name column (a container query in the grid class), so
  // the server's first paint is already clamped on a phone. widthOf mirrors
  // that rule for resizing and keyboard scrolling.
  const template = () =>
    `${SELECT_COLUMN}px var(--title-col) ${columns()
      .slice(1)
      .map((c) => `${widthOf(c.id)}px`)
      .join(" ")} ${ADD_COLUMN}px`;
  const gridVars = () => ({
    "--title-saved": `${savedWidth(TITLE_PROPERTY_ID)}px`,
    "grid-template-columns": template(),
  });
  const frozenWidth = () => SELECT_COLUMN + widthOf(TITLE_PROPERTY_ID);

  const resize = (id: string, width: number, done: boolean) => {
    setLiveWidths((w) => ({ ...w, [id]: width }));
    if (!done) return;
    opts.store.patchViewConfig(opts.view().id, {
      columnWidths: { ...(config().columnWidths ?? {}), [id]: width },
    });
    setLiveWidths((w) => {
      const next = { ...w };
      delete next[id];
      return next;
    });
  };

  const endDrag = () => {
    setDragId(null);
    setDrop(null);
  };
  const finishDrag = () => {
    const from = dragId();
    const target = drop();
    endDrag();
    if (!from || !target || from === target.id) return;
    if (target.id === TITLE_PROPERTY_ID) return;
    const ids = orderedProperties(opts.store.state.properties, config(), {
      includeHidden: true,
    })
      .map((p) => p.id)
      .filter((id) => id !== from);
    const at = ids.indexOf(target.id) + (target.side === "after" ? 1 : 0);
    ids.splice(at, 0, from);
    opts.store.patchViewConfig(opts.view().id, { propertyOrder: ids });
  };

  const dropSideOf = (id: string) =>
    dragId() && drop()?.id === id ? drop()!.side : null;

  return {
    columns,
    widthOf,
    gridVars,
    frozenWidth,
    resize,
    dropSideOf,
    startDrag: setDragId,
    dragOver: (id: string, side: "before" | "after") => setDrop({ id, side }),
    finishDrag,
    endDrag,
  };
}
