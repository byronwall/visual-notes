export type TocItem = {
  id: string;
  /** The heading's note block id (`data-id`), used for `#b-<id>` links. */
  blockId: string | null;
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  occurrence: number;
  el: HTMLElement;
};

export type TocMarker = {
  item: TocItem;
  index: number;
  topRatio: number;
  displayTopRatio: number;
  spanRatio: number;
};

/**
 * `pinned`: the outline sits open in the gutter right of the note.
 * `rail`: no room for it, so a slim marker rail opens the outline on hover.
 */
export type TocLayout = {
  mode: "pinned" | "rail";
  leftPx: number;
  widthPx: number;
  railHeightPx: number;
};
